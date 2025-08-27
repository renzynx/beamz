"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  previousValue,
  formatValue,
  className,
}: MetricCardProps) {
  const numericValue =
    typeof value === "string" ? Number.parseFloat(value) : value;

  const getPercentageChange = () => {
    if (previousValue === undefined || previousValue === 0) return null;
    return ((numericValue - previousValue) / previousValue) * 100;
  };

  const percentageChange = getPercentageChange();
  const isPositive = percentageChange !== null && percentageChange > 0;
  const isNegative = percentageChange !== null && percentageChange < 0;
  const isZero = percentageChange === 0;

  const displayValue = formatValue ? formatValue(numericValue) : value;

  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="p-0">
        <div className="space-y-2">
          <div className="text-muted-foreground text-sm">{title}</div>
          <div className="font-semibold text-2xl">{displayValue}</div>
          {percentageChange !== null && (
            <div className="flex items-center gap-1 text-xs">
              {isPositive && (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">
                    +{Math.abs(percentageChange).toFixed(1)}%
                  </span>
                </>
              )}
              {isNegative && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">
                    -{Math.abs(percentageChange).toFixed(1)}%
                  </span>
                </>
              )}
              {isZero && (
                <>
                  <Minus className="h-3 w-3 text-gray-500" />
                  <span className="text-gray-500">0%</span>
                </>
              )}
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
