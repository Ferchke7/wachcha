import type { Server } from 'node:http';

export function isHostAllowed(rawUrl: string, allowedSuffixes: string[]): boolean;
export function rewriteHlsManifest(text: string, baseUrl: string): string;
export function createWachchaServer(): Server;
