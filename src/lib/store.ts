import { writable, readable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { Spotify } from './spotify/spotify';
import { CONFIG } from './spotify/config';

export const is_logged_in: Writable<boolean | null> = writable(null);

export const spotify = readable(new Spotify(CONFIG));