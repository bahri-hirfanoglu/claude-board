import { io } from 'socket.io-client';

const URL = import.meta.env.DEV ? 'http://localhost:4000' : '/';
export const socket = io(URL, { autoConnect: true });
