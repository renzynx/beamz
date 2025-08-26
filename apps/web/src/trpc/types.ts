export type { RouterInputs, RouterOutputs } from "./client";

import type { RouterOutputs } from "./client";

export type FileItem = RouterOutputs["files"]["get"]["data"][0];
export type FilesResponse = RouterOutputs["files"]["get"];

export type UserItem = RouterOutputs["admin"]["getUsers"]["data"][0];
export type UsersResponse = RouterOutputs["admin"]["getUsers"];
