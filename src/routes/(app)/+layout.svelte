<script lang="ts">
	import {spotify, is_logged_in } from '$lib/store';
	import { onMount } from 'svelte';
    let user_name : string | null = null;

	const login = async () => {
		$spotify.login();
		$is_logged_in = await $spotify.isLoggedIn();
	};

    const logout = async () => {
        $spotify.logout()
        $is_logged_in = await $spotify.isLoggedIn()
    }

	onMount(async () => {
		$is_logged_in = await $spotify.isLoggedIn();
	});


    is_logged_in.subscribe(async (logged_in) => {
        if (logged_in) {
            user_name = await $spotify.getUserName();
        } else {
            user_name = null;
        }
    });

</script>

{#if $is_logged_in}
	{#if user_name}
		{user_name}
	{/if}
	<button on:click={logout}>Logout</button>
	<slot />
{:else}
	<p>You need to log in! and will be asked the following permissions</p>
	<button on:click={login}>Login</button>
{/if}
