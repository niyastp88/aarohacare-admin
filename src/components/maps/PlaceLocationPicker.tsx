import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { APP } from '@/constants/app';
import type { LocationDto } from '@/types/dto';

function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export interface PlaceSelection {
  place: string;
  location: LocationDto;
}

interface PlaceLocationPickerProps {
  value: PlaceSelection | null;
  onChange: (value: PlaceSelection) => void;
  error?: string;
}

interface Prediction {
  placeId: string;
  description: string;
  toPlace: () => google.maps.places.Place;
}

const mapContainerStyle = { width: '100%', height: '280px', borderRadius: '12px' };
const libraries: ('places')[] = ['places'];

function latLngOf(location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined) {
  if (!location) return null;
  if (typeof (location as google.maps.LatLng).lat === 'function') {
    const ll = location as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const literal = location as google.maps.LatLngLiteral;
  return { lat: literal.lat, lng: literal.lng };
}

function labelFromGeocodeResult(result: google.maps.GeocoderResult): string {
  const components = result.address_components || [];
  const pick = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;

  return (
    pick('premise', 'point_of_interest', 'establishment') ||
    pick('sublocality_level_1', 'sublocality', 'neighborhood') ||
    pick('locality') ||
    pick('administrative_area_level_2') ||
    result.formatted_address.split(',')[0]?.trim() ||
    result.formatted_address
  );
}

export const PlaceLocationPicker = (props: PlaceLocationPickerProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const online = useOnline();

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-waiting bg-waiting-soft px-4 py-3 text-sm text-gray-800">
        Add <code className="font-semibold">VITE_GOOGLE_MAPS_API_KEY</code> to{' '}
        <code>.env</code> (enable Maps JavaScript API + Places API (New)), then
        restart the web app.
      </div>
    );
  }

  if (!online) {
    return (
      <div className="rounded-xl border border-waiting bg-waiting-soft px-4 py-3 text-sm text-gray-800">
        Maps need an internet connection. Reconnect to search a place or pin it on the map.
        {props.value?.place ? (
          <p className="mt-2 font-semibold text-[#1A1F36]">{props.value.place}</p>
        ) : null}
      </div>
    );
  }

  return <LoadedPlaceLocationPicker apiKey={apiKey} {...props} />;
};

const LoadedPlaceLocationPicker = ({
  apiKey,
  value,
  onChange,
  error,
}: PlaceLocationPickerProps & { apiKey: string }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'aarohcare-maps',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [query, setQuery] = useState(value?.place ?? '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const debounceRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const center = useMemo(
    () =>
      value?.location
        ? { lat: value.location.lat, lng: value.location.lng }
        : APP.DEFAULT_MAP_CENTER,
    [value],
  );

  useEffect(() => {
    if (value?.place && value.place !== query) {
      setQuery(value.place);
    }
    // Only sync when parent value changes, not on every keystroke.
  }, [value?.place]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const ensureSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, []);

  const applySelection = useCallback(
    (placeName: string, lat: number, lng: number, formattedAddress?: string) => {
      const selection: PlaceSelection = {
        place: placeName,
        location: { lat, lng, formattedAddress: formattedAddress || placeName },
      };
      setQuery(placeName);
      setPredictions([]);
      setOpen(false);
      setPlacesError(null);
      onChange(selection);
      map?.panTo({ lat, lng });
    },
    [map, onChange],
  );

  const applyPlace = useCallback(
    async (place: google.maps.places.Place, fallbackLabel?: string) => {
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const coords = latLngOf(place.location);
      if (!coords) {
        setPlacesError('Could not read coordinates for that place. Try another result.');
        return;
      }
      const label =
        place.displayName ||
        place.formattedAddress ||
        fallbackLabel ||
        `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      applySelection(label, coords.lat, coords.lng, place.formattedAddress || label);
      resetSessionToken();
    },
    [applySelection, resetSessionToken],
  );

  const fetchPredictions = useCallback(
    async (input: string) => {
      if (!isLoaded || !input.trim() || input.trim().length < 2) {
        setPredictions([]);
        return;
      }

      const AutocompleteSuggestion = google.maps.places.AutocompleteSuggestion;
      if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        setPlacesError(
          'Places Autocomplete (New) is unavailable. In Google Cloud, enable “Places API (New)” and add it to this API key’s restrictions.',
        );
        setPredictions([]);
        return;
      }

      try {
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: input.trim(),
          includedRegionCodes: [APP.MAP_COUNTRY],
          language: 'en-IN',
          region: APP.MAP_COUNTRY,
          sessionToken: ensureSessionToken(),
          locationBias: {
            center: APP.DEFAULT_MAP_CENTER,
            radius: 50_000, // Places API (New) max circle bias is 50 km
          },
        });

        const next: Prediction[] = (suggestions || [])
          .map((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;
            return {
              placeId: prediction.placeId,
              description: prediction.text?.toString() || prediction.mainText?.toString() || '',
              toPlace: () => prediction.toPlace(),
            };
          })
          .filter((item): item is Prediction => Boolean(item?.placeId && item.description));

        setPredictions(next);
        setOpen(next.length > 0);
        setPlacesError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Places autocomplete failed';
        setPredictions([]);
        const needsApiHint = /denied|permission|not enabled|api key/i.test(message);
        setPlacesError(
          needsApiHint
            ? `${message} Enable “Places API (New)” for this key.`
            : message,
        );
      }
    },
    [ensureSessionToken, isLoaded],
  );

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void fetchPredictions(next);
    }, 280);
  };

  const selectPrediction = async (prediction: Prediction) => {
    try {
      await applyPlace(prediction.toPlace(), prediction.description);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load place details';
      setPlacesError(message);
    }
  };

  const selectByPlaceId = async (placeId: string) => {
    try {
      const place = new google.maps.places.Place({ id: placeId });
      await applyPlace(place);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load that map place';
      setPlacesError(message);
    }
  };

  const resolvePinnedPlace = useCallback(async (lat: number, lng: number) => {
    // Prefer Places API (New) nearby search — same APIs already used for autocomplete.
    try {
      const Place = google.maps.places.Place;
      const RankPreference = google.maps.places.SearchNearbyRankPreference;
      if (Place?.searchNearby) {
        const { places } = await Place.searchNearby({
          fields: ['displayName', 'formattedAddress', 'location'],
          locationRestriction: {
            center: { lat, lng },
            radius: 180,
          },
          maxResultCount: 8,
          rankPreference: RankPreference?.DISTANCE,
        });

        const best = places?.[0];
        const placeName = best?.displayName || best?.formattedAddress;
        if (placeName) {
          return {
            placeName,
            formattedAddress: best?.formattedAddress || placeName,
          };
        }
      }
    } catch {
      // Fall through to Geocoder / coordinate label.
    }

    // Optional Geocoding API (only if enabled on the key).
    try {
      const result = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) resolve(results[0]);
          else resolve(null);
        });
      });
      if (result) {
        return {
          placeName: labelFromGeocodeResult(result),
          formattedAddress: result.formatted_address,
        };
      }
    } catch {
      // Fall through.
    }

    return {
      placeName: `Pinned · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      formattedAddress: undefined as string | undefined,
    };
  }, []);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    // Prefer Places details when the user taps a POI (hospital, clinic, etc.).
    const placeId = (event as google.maps.MapMouseEvent & { placeId?: string }).placeId;
    if (placeId) {
      event.stop?.();
      void selectByPlaceId(placeId);
      return;
    }

    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    void (async () => {
      setPlacesError(null);
      // Immediate pin so the marker updates while the name resolves.
      applySelection(`Pinned · ${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
      try {
        const resolved = await resolvePinnedPlace(lat, lng);
        applySelection(resolved.placeName, lat, lng, resolved.formattedAddress);
      } catch {
        // Coordinates already saved; keep the pin label.
      }
    })();
  };


  if (loadError) {
    return (
      <div className="rounded-xl border border-error bg-error-soft px-4 py-3 text-sm text-error">
        Could not load Google Maps. Check your internet connection, API key, and enabled APIs.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" ref={wrapRef}>
      <div className="relative">
        <label className="mb-1.5 block text-sm font-semibold text-gray-900">Place / city</label>
        <input
          className={[
            'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-primary',
            error ? 'border-error' : 'border-border',
          ].join(' ')}
          placeholder="Start typing a place name…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {open && predictions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-white shadow-lg">
            {predictions.map((item) => (
              <li key={item.placeId}>
                <button
                  type="button"
                  className="w-full px-3.5 py-2.5 text-left text-sm text-gray-900 hover:bg-primary-light"
                  onClick={() => void selectPrediction(item)}
                >
                  {item.description}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <span className="mt-1 block text-[13px] text-error">{error}</span>}
        {placesError && (
          <span className="mt-1 block text-[13px] text-waiting">{placesError}</span>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-gray-900">Pin on map</p>
        <p className="mb-2 text-[13px] text-muted">
          Tap the map (or a place marker) to set location. The place name updates automatically.
        </p>
        {!isLoaded ? (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted">
            Loading map…
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={value ? 15 : 11}
            onLoad={setMap}
            onClick={handleMapClick}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              clickableIcons: true,
            }}
          >
            {value && <Marker position={{ lat: value.location.lat, lng: value.location.lng }} />}
          </GoogleMap>
        )}
        {value?.location.formattedAddress && (
          <p className="mt-2 text-[13px] text-muted">{value.location.formattedAddress}</p>
        )}
      </div>
    </div>
  );
};
