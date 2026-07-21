import PocketBase from '@pocketbase/js';

// Change this URL when you host PocketBase elsewhere (ngrok, VPS, etc.)
const PB_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';
export const pb = new PocketBase(PB_URL);

// Persist token across reloads
pb.authStore.onChange(() => {
  localStorage.setItem('pb_auth', pb.authStore.token ?? '');
});
const saved = localStorage.getItem('pb_auth');
if (saved) pb.authStore.save(saved);

export const getUserId = () => pb.authStore.model?.id;
export default pb;
