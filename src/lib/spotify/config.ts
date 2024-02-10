import type { SpotifyAuthConfig } from "./spotify";
import { base } from "$app/paths";



export const CONFIG: SpotifyAuthConfig = {
    client_id: "5c84cbaecef5498a904d81a6a11b07a1",
    redirect_endpoint: base + "/callback",
    scope: [
        "user-read-currently-playing",
        "playlist-read-private",
        "playlist-modify-private",
        "playlist-modify-public",
    ],
}