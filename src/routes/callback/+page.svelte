<script lang="ts">
    import {onMount} from "svelte";
    import {spotify} from "$lib/store";

    onMount(async () => {
        $spotify.handleCallback();
    })

</script>

In callback