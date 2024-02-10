<script lang="ts">
	import Tags from 'svelte-tags-input';
	import { spotify, is_logged_in } from '$lib/store';
	import type { Playlist, SpotifyTrack } from '$lib/spotify/spotify';

	let name: string = '';
	let playlists: Playlist[] | null = null;
	let included_playlists: Playlist[] = [];
	let required_playlists: Playlist[] = [];
	let excluded_playlists: Playlist[] = [];
	let unselected_playlists: Playlist[] = [];

	let included_tracks = new Set<SpotifyTrack>();
	let required_tracks = new Set<SpotifyTrack>();
	let excluded_tracks = new Set<SpotifyTrack>();
	let seleted_tracks: SpotifyTrack[] = [];

	is_logged_in.subscribe(async (logged_in) => {
		if (logged_in) {
			playlists = await $spotify.getPlaylists();
            playlists.filter(p => p.description?.startsWith('@')).forEach(async p => {
                if (p.description == null) return;
                const description = JSON.parse(p.description.slice(1).replace(/&quot;/g,'"'));
                const included_playlists = description.included_playlists;
                const required_playlists = description.required_playlists;
                const excluded_playlists = description.excluded_playlists;
                const included_tracks = await getTracks(included_playlists);
                const required_tracks = await getTracks(required_playlists);
                const excluded_tracks = await getTracks(excluded_playlists);
                let tracks = difference(included_tracks, excluded_tracks, (t) => t.id);
                if (required_playlists.length > 0) {
                    tracks = intersection(tracks, required_tracks, (t) => t.id);
                }
                await $spotify.replaceTracksInPlaylist(Array.from(tracks), p);
                console.log('Updated playlist', p.name);
            })
		}
	});

	$: if (playlists) {
		unselected_playlists = playlists.filter(
			(p) =>
				!included_playlists.includes(p) &&
				!required_playlists.includes(p) &&
				!excluded_playlists.includes(p)
		);
	}

	const getTracks = async (ps: Playlist[]): Promise<Set<SpotifyTrack>> => {
		return new Set((await Promise.all(ps.map((p) => $spotify.getTracksInPlaylist(p)))).flat());
	};

	const intersection = <T, S>(a: Set<T>, b: Set<T>, key: (x: T) => S): Set<T> => {
		const converted_b = new Set([...b].map(key));
		return new Set([...a].filter((x) => converted_b.has(key(x))));
	};

	const difference = <T, S>(a: Set<T>, b: Set<T>, key: (x: T) => S): Set<T> => {
		const converted_b = new Set([...b].map(key));
		return new Set([...a].filter((x) => !converted_b.has(key(x))));
	};

	$: getTracks(included_playlists).then((tracks) => (included_tracks = tracks));
	$: getTracks(required_playlists).then((tracks) => (required_tracks = tracks));
	$: getTracks(excluded_playlists).then((tracks) => (excluded_tracks = tracks));

	$: {
		let tracks = difference(included_tracks, excluded_tracks, (t) => t.id);
		if (required_playlists.length > 0) {
			tracks = intersection(tracks, required_tracks, (t) => t.id);
		}
		seleted_tracks = Array.from(tracks);
	}

	const create = async () => {
		const description = "@" + JSON.stringify({
			included_playlists: included_playlists,
			required_playlists: required_playlists,
			excluded_playlists: excluded_playlists
		});
		const playlist = await $spotify.createPlaylist(name, description);
		await $spotify.addTracksToPlaylist(Array.from(seleted_tracks), playlist);
	};
</script>

<h1>Create playlist</h1>

Name: <p>
	<input bind:value={name} />
</p>

Include:
<Tags
	bind:tags={included_playlists}
	autoComplete={unselected_playlists}
	autoCompleteKey={'name'}
	onlyAutocomplete={true}
	onlyUnique={true}
/>

Require:
<Tags
	bind:tags={required_playlists}
	autoComplete={unselected_playlists}
	autoCompleteKey={'name'}
	onlyAutocomplete={true}
	onlyUnique={true}
/>

Exclude:
<Tags
	bind:tags={excluded_playlists}
	autoComplete={unselected_playlists}
	autoCompleteKey={'name'}
	onlyAutocomplete={true}
	onlyUnique={true}
/>

<button on:click={create} disabled={name == ''}>Create</button>

<h2>Selected {seleted_tracks.length} Tracks</h2>
{#each seleted_tracks as track}
    <p>{track.name}</p>
{/each}
