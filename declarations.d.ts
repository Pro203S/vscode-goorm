declare global {
    type LoginInfo = APIToken & {
        requestedOn: number;
    };

    interface APIToken {
        access_token: string;
        token_type: string;
        scope: string;
        expires_in: number;
        refresh_token: string;
    }

    interface APIMe {
        "country": string,
        "display_name": string,
        "email": string,
        "explicit_content": {
            "filter_enabled": boolean,
            "filter_locked": boolean
        },
        "external_urls": {
            "spotify": string
        },
        "followers": {
            "href": any,
            "total": number
        },
        "href": string,
        "id": string,
        "images": [],
        "product": string,
        "type": "user",
        "uri": string
    }

    interface APIMePlayer {
        device: {
            id: string | null;
            is_active: boolean;
            is_private_session: boolean;
            is_restricted: boolean;
            name: string;
            type: string;
            volume_percent: number | null;
            supports_volume: boolean;
        };

        repeat_state: "off" | "track" | "context";
        shuffle_state: boolean;

        context: {
            type: "artist" | "playlist" | "album" | "show";
            href: string;
            external_urls: {
                spotify: string;
            };
            uri: string;
        } | null;

        timestamp: number;
        progress_ms: number | null;
        is_playing: boolean;

        item: {
            album: {
                album_type: "album" | "single" | "compilation";
                total_tracks: number;
                external_urls: {
                    spotify: string;
                };
                href: string;
                id: string;
                images: {
                    url: string;
                    height: number | null;
                    width: number | null;
                }[];
                name: string;
                release_date: string;
                release_date_precision: "year" | "month" | "day";
                type: "album";
                uri: string;
                artists: {
                    external_urls: {
                        spotify: string;
                    };
                    href: string;
                    id: string;
                    name: string;
                    type: "artist";
                    uri: string;
                }[];
            };

            artists: {
                external_urls: {
                    spotify: string;
                };
                href: string;
                id: string;
                name: string;
                type: "artist";
                uri: string;
            }[];

            disc_number: number;
            duration_ms: number;
            explicit: boolean;

            external_ids: {
                isrc?: string;
                ean?: string;
                upc?: string;
            };

            external_urls: {
                spotify: string;
            };

            href: string;
            id: string;
            is_playable: boolean;
            name: string;
            popularity: number;
            preview_url: string | null;
            track_number: number;
            type: "track";
            uri: string;
            is_local: boolean;
        } | null;

        currently_playing_type: "track" | "episode" | "ad" | "unknown";

        actions: {
            disallows: {
                resuming?: boolean;
                skipping_prev?: boolean;
                skipping_next?: boolean;
                seeking?: boolean;
                pausing?: boolean;
            };
        };

        smart_shuffle?: boolean;
    }

    interface APIMePlayerDevice {
        "id": string,
        "is_active": boolean,
        "is_private_session": boolean,
        "is_restricted": boolean,
        "name": string,
        "type": string,
        "volume_percent": number,
        "supports_volume": boolean
    }
}

export { }; 