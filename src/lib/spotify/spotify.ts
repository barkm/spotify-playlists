import { browser } from '$app/environment';

export interface SpotifyAuthConfig {
	client_id: string;
	scope: string[];
	redirect_endpoint: string;
}

const toLocalStorage = (key: string, value: string) => {
	if (!browser) {
		return;
	}
	localStorage.setItem(key, value);
};

const fromLocalStorage = (key: string): string | null => {
	if (!browser) {
		return null;
	}
	return localStorage.getItem(key);
};

const generateRandomString = (length: number) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return crypto.subtle.digest('SHA-256', data);
};

const base64Encode = (input: ArrayBuffer) => {
	return btoa(String.fromCharCode(...new Uint8Array(input)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
};

// Logs in user by redirecting to Spotify's login page
// and redirecting to config.redirect_uri with a code
const login = async (config: SpotifyAuthConfig): Promise<void> => {
	const code_verifier = generateRandomString(64);
	toLocalStorage('code_verifier', code_verifier);
	const hashed = await sha256(code_verifier);
	const code_challenge = base64Encode(hashed);
	const params = {
		response_type: 'code',
		client_id: config.client_id,
		scope: config.scope.join(' '),
		code_challenge_method: 'S256',
		code_challenge: code_challenge,
		redirect_uri: window.location.origin + config.redirect_endpoint
	};
	const auth_url = new URL('https://accounts.spotify.com/authorize');
	auth_url.search = new URLSearchParams(params).toString();
	toLocalStorage('redirect_uri', window.location.href);
	window.location.replace(auth_url.toString());
};

// to be called on the redirect_uri page
const handleCallback = async (config: SpotifyAuthConfig) => {
	console.log('Fetching access token');
	let code_verifier = fromLocalStorage('code_verifier');
	if (!code_verifier) {
		throw new Error('No code verifier');
	}
	const url = new URL(window.location.href);
	const code = url.searchParams.get('code');
	if (!code) {
		throw new Error('No code');
	}
	const response = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			client_id: config.client_id,
			grant_type: 'authorization_code',
			code: code,
			redirect_uri: window.location.origin + config.redirect_endpoint,
			code_verifier: code_verifier
		})
	});
	const body = await response.json();
	if (response.status != 200) {
		throw new Error('Failed to fetch access token');
	}
	const access_token = body.access_token;
	const refresh_token = body.refresh_token;
	if (!access_token || !refresh_token) {
		throw new Error('Reponse did not contain access token and refresh token');
	}
	const expires_at = Date.now() + 1000 * body.expires_in;
	console.log('saving access tokens');
	console.log(access_token, expires_at, refresh_token);

	toLocalStorage('access_token', access_token);
	toLocalStorage('expires_at', expires_at.toString());
	toLocalStorage('refresh_token', refresh_token);
	window.location.replace(fromLocalStorage('redirect_uri') || '/');
};

const refreshAccessToken = async (config: SpotifyAuthConfig) => {
	console.log('refreshing acess token');
	const refresh_token = fromLocalStorage('refresh_token') as string;
	console.log(refresh_token);

	const url = 'https://accounts.spotify.com/api/token';
	const payload = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refresh_token,
			client_id: config.client_id
		})
	};
	const body = await fetch(url, payload);
	const response = await body.json();
	const expires_at = Date.now() + 1000 * response.expires_in;
	toLocalStorage('access_token', response.access_token);
	toLocalStorage('expires_at', expires_at.toString());
	toLocalStorage('refresh_token', response.refresh_token);
};

const logout = () => {
	localStorage.removeItem('access_token');
	localStorage.removeItem('expires_at');
	localStorage.removeItem('refresh_token');
};

const getAccessToken = async (config: SpotifyAuthConfig): Promise<string | null> => {
	const access_token = fromLocalStorage('access_token');
	const expires_at = fromLocalStorage('expires_at');
	if (!access_token) {
		console.log('No access token');
		return null;
	}
	if (!expires_at) {
		console.log('No expires at');
		return null;
	}
	if (Date.now() > Number(expires_at)) {
		console.log('Access token expired');
		await refreshAccessToken(config);
		return getAccessToken(config);
	}
	return access_token;
};

const isLoggedIn = async (config: SpotifyAuthConfig): Promise<boolean> => {
	const access_token = await getAccessToken(config);
	return access_token !== null;
};

async function request(
	config: SpotifyAuthConfig,
	endpoint: string,
	method: 'GET' | 'POST' | 'DELETE' | 'PUT',
	search_params?: any,
	body?: any
): Promise<Response> {
	console.log(endpoint, method);
	const access_token = await getAccessToken(config);
	if (!access_token) {
		throw Error();
	}
	let url = new URL('https://api.spotify.com/v1' + endpoint);
	if (search_params) {
		url.search = new URLSearchParams(search_params).toString();
	}
	const response = await fetch(url.toString(), {
		method: method,
		headers: {
			Authorization: 'Bearer ' + access_token,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: body ? JSON.stringify(body) : null
	});
	// handle unchanged response
	return response;
}

const getUser = async (config: SpotifyAuthConfig): Promise<{ name: string; id: string }> => {
	const response = await request(config, '/me', 'GET');
	if (response.status !== 200) {
		throw Error();
	}
	const body = await response.json();
	return {
		name: body.display_name,
		id: body.id
	};
};

const getUserName = async (config: SpotifyAuthConfig): Promise<string> => {
	return (await getUser(config)).name;
};

export interface SpotifyTrack {
	id: string;
	name: string;
	artists: string[];
}

export interface SpotifyTag {
	name: string;
	playlist_id: string;
}

export interface Playlist {
	name: string;
	id: string;
	description?: string;
}

export class Spotify {
	constructor(private config: SpotifyAuthConfig) {}

	async isLoggedIn(): Promise<boolean> {
		return await isLoggedIn(this.config);
	}

	async login(): Promise<void> {
		await login(this.config);
	}

	async handleCallback(): Promise<void> {
		await handleCallback(this.config);
	}

	async logout(): Promise<void> {
		logout();
	}

	async getUserName(): Promise<string> {
		return await getUserName(this.config);
	}

	async getPlaylists(params?: URLSearchParams): Promise<Playlist[]> {
		const response = await request(this.config, '/me/playlists', 'GET', params ? params : { limit: 50 });
		if (response.status != 200) {
			throw Error();
		}
		const body = await response.json();
		let playlists = body.items.map((playlist: any) => {
			return { name: playlist.name, id: playlist.id, description: playlist.description };
		});
		if (body['next']) {
			const next_params = new URL(body['next']).searchParams;
			const next_playlists = await this.getPlaylists(next_params);
			playlists = playlists.concat(next_playlists);
		}
		return playlists
	}

	async getTracksInPlaylist(playlist: Playlist, params?: URLSearchParams): Promise<SpotifyTrack[]> {
		const response = await request(
			this.config,
			`/playlists/${playlist.id}/tracks`,
			'GET',
			params ? params : { limit: 50 }
		);
		const data = await response.json();
		let tracks = data['items'].map((item: any): SpotifyTrack => {
			return {
				id: item.track.id,
				name: item.track.name,
				artists: item.track.artists.map((artist: any) => artist.name)
			};
		});
		if (data['next']) {
			const next_params = new URL(data['next']).searchParams;
			const next_tracks = await this.getTracksInPlaylist(playlist, next_params);
			tracks = tracks.concat(next_tracks);
		}
		return tracks;
	}

	async createPlaylist(name: string, description?: string): Promise<Playlist> {
		const user_id = (await getUser(this.config)).id;
		const response = await request(this.config, `/users/${user_id}/playlists`, 'POST', null, {
			name: name,
			public: false,
			description: description
		});
		if (response.status != 201) {
			throw Error();
		}
		const body = await response.json();
		if (description) {
			await request(this.config, `/playlists/${body.id}`, 'PUT', null, {
				description: description
			});
		}
		return {
			name: body.name,
			id: body.id,
			description: body.description
		};
	}

	async addTracksToPlaylist(tracks: SpotifyTrack[], playlist: Playlist): Promise<void> {
		if (tracks.length == 0) {
			return;
		}
		const response = await request(this.config, `/playlists/${playlist.id}/tracks`, 'POST', null, {
			uris: tracks.map((t) => 'spotify:track:' + t.id)
		});
		if (response.status != 201) {
			throw Error();
		}
	}

	async replaceTracksInPlaylist(tracks: SpotifyTrack[], playlist: Playlist): Promise<void> {
		const response = await request(this.config, `/playlists/${playlist.id}/tracks`, 'PUT', null, {
			uris: tracks.map((t) => 'spotify:track:' + t.id)
		});
		if (response.status != 201) {
			throw Error();
		}
	}

	async removeTrackFromPlaylist(track: SpotifyTrack, playlist_id: string): Promise<void> {
		const response = await request(
			this.config,
			`/playlists/${playlist_id}/tracks`,
			'DELETE',
			null,
			{
				uris: [`spotify:track:${track.id}`]
			}
		);
		if (response.status != 200) {
			throw Error();
		}
	}

	async addTrackToPlaylist(track: SpotifyTrack, playlist_id: string): Promise<void> {
		const response = await request(this.config, `/playlists/${playlist_id}/tracks`, 'POST', null, {
			uris: [`spotify:track:${track.id}`]
		});
		if (response.status != 201) {
			throw Error();
		}
	}
}
