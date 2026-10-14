import { setupWorker } from "msw/browser";
import { createMockApi } from "./handlers";

export const worker = setupWorker(...createMockApi().handlers);
