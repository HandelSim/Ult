import path from 'path';

export const WORKSPACE_ROOT = process.env.SMITH_WORKSPACE || path.join(process.env.HOME || '/root', 'smith-projects');
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const CLIENT_DIST = path.join(__dirname, '../../client/dist');
