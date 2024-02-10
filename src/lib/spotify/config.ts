import type { SpotifyAuthConfig } from "./spotify";
import { page } from "$app/stores"

console.log(page);


export const CONFIG: SpotifyAuthConfig = {
    client_id: "5c84cbaecef5498a904d81a6a11b07a1",
    redirect_endpoint: "/callback",
    scope: [
        "user-read-currently-playing",
        "playlist-read-private",
        "playlist-modify-private",
        "playlist-modify-public",
    ],
}