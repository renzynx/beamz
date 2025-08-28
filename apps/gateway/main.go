package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ProxyPort         string
	NextJSURL         string
	APIURL            string
	BaseURL           string
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	UploadReadTimeout time.Duration
	LogRequests       bool
}

type ProxyServer struct {
	config      Config
	nextjsProxy *httputil.ReverseProxy
	apiProxy    *httputil.ReverseProxy
}

func loadConfig() Config {
	config := Config{
		ProxyPort:         getEnv("PROXY_PORT", "8080"),
		NextJSURL:         getEnv("NEXTJS_URL", "http://localhost:3000"),
		APIURL:            getEnv("API_URL", "http://localhost:3333"),
		BaseURL:           getEnv("BASE_URL", "http://localhost:8080"),
		ReadTimeout:       getDurationEnv("READ_TIMEOUT", 30*time.Second),
		WriteTimeout:      getDurationEnv("WRITE_TIMEOUT", 30*time.Second),
		IdleTimeout:       getDurationEnv("IDLE_TIMEOUT", 120*time.Second),
		UploadReadTimeout: getDurationEnv("UPLOAD_READ_TIMEOUT", 10*time.Minute),
		LogRequests:       getBoolEnv("LOG_REQUESTS", true),
	}

	// Validate URLs
	if _, err := url.Parse(config.NextJSURL); err != nil {
		log.Fatal("Invalid NEXTJS_URL:", err)
	}
	if _, err := url.Parse(config.APIURL); err != nil {
		log.Fatal("Invalid API_URL:", err)
	}
	if _, err := url.Parse(config.BaseURL); err != nil {
		log.Fatal("Invalid BASE_URL:", err)
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if parsed, err := time.ParseDuration(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func NewProxyServer(config Config) (*ProxyServer, error) {
	nextjsURL, err := url.Parse(config.NextJSURL)
	if err != nil {
		return nil, fmt.Errorf("invalid NextJS URL: %w", err)
	}

	apiURL, err := url.Parse(config.APIURL)
	if err != nil {
		return nil, fmt.Errorf("invalid API URL: %w", err)
	}

	ps := &ProxyServer{
		config:      config,
		nextjsProxy: httputil.NewSingleHostReverseProxy(nextjsURL),
		apiProxy:    httputil.NewSingleHostReverseProxy(apiURL),
	}

	ps.setupAPIProxy(apiURL)
	ps.setupNextJSProxy(nextjsURL, apiURL)

	return ps, nil
}

func (ps *ProxyServer) setupAPIProxy(apiURL *url.URL) {
	originalDirector := ps.apiProxy.Director
	ps.apiProxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = apiURL.Host
	}

	ps.apiProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		ps.handleProxyError(w, r, err, "API server", ps.config.APIURL)
	}
}

func (ps *ProxyServer) setupNextJSProxy(nextjsURL, apiURL *url.URL) {
	ps.nextjsProxy.Transport = &http.Transport{
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
		MaxIdleConnsPerHost: 10,
	}

	originalDirector := ps.nextjsProxy.Director
	ps.nextjsProxy.Director = func(req *http.Request) {
		// Store original host for header forwarding
		originalHost := req.Host
		originalXForwardedHost := req.Header.Get("X-Forwarded-Host")

		originalDirector(req)

		// Handle NextJS image optimization requests
		if req.URL.Path == "/_next/image" {
			ps.modifyImageURL(req)
		}

		// Redirect internal API requests to API server
		if strings.HasPrefix(req.URL.Path, "/api/") {
			req.URL.Scheme = apiURL.Scheme
			req.URL.Host = apiURL.Host
			req.Host = apiURL.Host
			if ps.config.LogRequests {
				log.Printf("NextJS internal API request: %s %s -> %s", req.Method, req.URL.Path, ps.config.APIURL)
			}
		} else {
			req.Host = nextjsURL.Host

			if originalXForwardedHost == "" {
				req.Header.Set("X-Forwarded-Host", originalHost)
			}
			req.Header.Set("X-Forwarded-Proto", "http")
			if ps.config.BaseURL != "" {
				if baseURL, err := url.Parse(ps.config.BaseURL); err == nil {
					req.Header.Set("X-Forwarded-Proto", baseURL.Scheme)
					if baseURL.Host != "" {
						req.Header.Set("X-Forwarded-Host", baseURL.Host)
					}
				}
			}

			// Remove conflicting headers that might cause issues
			req.Header.Del("X-Forwarded-For")
		}
	}

	ps.nextjsProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		ps.handleProxyError(w, r, err, "NextJS server", ps.config.NextJSURL)
	}
}

func (ps *ProxyServer) modifyImageURL(req *http.Request) {
	query := req.URL.Query()
	imageURL := query.Get("url")
	if imageURL != "" && strings.HasPrefix(imageURL, "/f/") {
		newImageURL := ps.config.BaseURL + imageURL
		query.Set("url", newImageURL)
		req.URL.RawQuery = query.Encode()
	}
}

func (ps *ProxyServer) handleProxyError(w http.ResponseWriter, _ *http.Request, err error, serverType, serverURL string) {
	if err != context.Canceled && !strings.Contains(err.Error(), "context canceled") {
		log.Printf("%s proxy error (%s): %v", serverType, serverURL, err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadGateway)
	fmt.Fprintf(w, `{"error": "%s is not available", "status": 502}`, serverType)
}

func (ps *ProxyServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		if ps.config.LogRequests {
			log.Printf("API request: %s %s", r.Method, r.URL.Path)
		}
		ps.apiProxy.ServeHTTP(w, r)
	} else {
		if ps.config.LogRequests {
			log.Printf("NextJS request: %s %s", r.Method, r.URL.Path)
		}
		ps.nextjsProxy.ServeHTTP(w, r)
	}
}

func (ps *ProxyServer) Start() error {
	server := &http.Server{
		Addr:         ":" + ps.config.ProxyPort,
		Handler:      ps,
		ReadTimeout:  ps.config.ReadTimeout,
		WriteTimeout: ps.config.WriteTimeout,
		IdleTimeout:  ps.config.IdleTimeout,
	}

	ps.printStartupInfo()
	return server.ListenAndServe()
}

func (ps *ProxyServer) printStartupInfo() {
	fmt.Printf("🚀 Proxy Server Starting\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	fmt.Printf("📍 Proxy Port:    %s\n", ps.config.ProxyPort)
	fmt.Printf("🔗 Base URL:      %s\n", ps.config.BaseURL)
	fmt.Printf("⚛️ NextJS Server: %s\n", ps.config.NextJSURL)
	fmt.Printf("🔧 API Server:    %s\n", ps.config.APIURL)
	fmt.Printf("⏱️ Timeouts:     R:%v W:%v I:%v\n",
		ps.config.ReadTimeout, ps.config.WriteTimeout, ps.config.IdleTimeout)
	fmt.Printf("📝 Logging:       %v\n", ps.config.LogRequests)
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	fmt.Printf("🌐 Access your application at: %s\n", ps.config.BaseURL)
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
}

func main() {
	config := loadConfig()

	proxy, err := NewProxyServer(config)
	if err != nil {
		log.Fatal("Failed to create proxy server:", err)
	}

	uploadsDir := filepath.Join("..", "..", "uploads")

	if abs, err := filepath.Abs(uploadsDir); err == nil {
		uploadsDir = abs
	}

	fs := http.StripPrefix("/f/", http.FileServer(http.Dir(uploadsDir)))

	uploadsHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, "/f/")
		relClean := path.Clean("/" + rel)

		trimmed := strings.TrimPrefix(relClean, "/")
		if trimmed == "" {
		} else {
			firstSeg := strings.SplitN(trimmed, "/", 2)[0]
			if firstSeg == "tmp" {
				http.NotFound(w, r)
				return
			}
		}

		w.Header().Set("Cache-Control", "public, max-age=3600, immutable")
		fs.ServeHTTP(w, r)
	})

	mux := http.NewServeMux()
	mux.Handle("/f/", uploadsHandler)

	if apiURL, err := url.Parse(proxy.config.APIURL); err == nil {
		uploadProxy := httputil.NewSingleHostReverseProxy(apiURL)
		uploadProxy.Transport = &http.Transport{
			MaxIdleConns:        100,
			IdleConnTimeout:     120 * time.Second,
			DisableCompression:  false,
			MaxIdleConnsPerHost: 100,
		}

		mux.Handle("/api/upload", uploadProxy)
		mux.Handle("/api/upload/", uploadProxy)
	} else {
		if proxy.config.LogRequests {
			log.Printf("Invalid API URL for upload proxy: %v", err)
		}
	}

	mux.Handle("/", proxy)

	if proxy.config.LogRequests {
		log.Printf("Serving static uploads from %s at /f/", uploadsDir)
	}

	readTimeout := proxy.config.ReadTimeout
	if proxy.config.UploadReadTimeout > readTimeout {
		readTimeout = proxy.config.UploadReadTimeout
	}

	server := &http.Server{
		Addr:         ":" + proxy.config.ProxyPort,
		Handler:      mux,
		ReadTimeout:  readTimeout,
		WriteTimeout: proxy.config.WriteTimeout,
		IdleTimeout:  proxy.config.IdleTimeout,
	}

	proxy.printStartupInfo()

	if err := server.ListenAndServe(); err != nil {
		log.Fatal("Proxy server failed:", err)
	}
}
