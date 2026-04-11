import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";

const META_TTL_MS = 30_000;
const metaCache = new Map();

function getCacheEntry(key) {
  const entry = metaCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    metaCache.delete(key);
    return null;
  }
  return entry;
}

function readCachedValue(key, fallback) {
  return getCacheEntry(key)?.value ?? fallback;
}

async function loadCached(key, loader, { force = false } = {}) {
  if (!force) {
    const existing = getCacheEntry(key);
    if (existing?.promise) return existing.promise;
    if (existing && Object.prototype.hasOwnProperty.call(existing, "value")) {
      return existing.value;
    }
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      metaCache.set(key, {
        value,
        expiresAt: Date.now() + META_TTL_MS,
      });
      return value;
    })
    .catch((error) => {
      metaCache.delete(key);
      throw error;
    });

  metaCache.set(key, {
    value: readCachedValue(key, null),
    promise,
    expiresAt: Date.now() + META_TTL_MS,
  });

  return promise;
}

export function useResearcherMeta({
  includeGroups = false,
  includeSurveys = false,
  includeElements = false,
  includeInactiveElements = false,
} = {}) {
  const elementsKey = `elements:${includeInactiveElements ? "all" : "active"}`;
  const initialState = useMemo(
    () => ({
      groups: includeGroups ? readCachedValue("groups", []) : [],
      surveys: includeSurveys ? readCachedValue("surveys", []) : [],
      elements: includeElements ? readCachedValue(elementsKey, []) : [],
    }),
    [elementsKey, includeElements, includeGroups, includeSurveys],
  );

  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(
    () =>
      (includeGroups && !getCacheEntry("groups")) ||
      (includeSurveys && !getCacheEntry("surveys")) ||
      (includeElements && !getCacheEntry(elementsKey)),
  );
  const [error, setError] = useState(null);
  const stateRef = useRef(initialState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(
    async ({ force = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const [groups, surveys, elements] = await Promise.all([
          includeGroups
            ? loadCached("groups", () => api.listGroups().then((data) => (Array.isArray(data) ? data : [])), {
                force,
              })
            : Promise.resolve(stateRef.current.groups),
          includeSurveys
            ? loadCached(
                "surveys",
                () => api.getAvailableSurveys().then((data) => (Array.isArray(data) ? data : [])),
                { force },
              )
            : Promise.resolve(stateRef.current.surveys),
          includeElements
            ? loadCached(
                elementsKey,
                () =>
                  api
                    .listElements({ includeInactive: includeInactiveElements })
                    .then((data) => (Array.isArray(data) ? data : data?.elements || [])),
                { force },
              )
            : Promise.resolve(stateRef.current.elements),
        ]);

        setState({
          groups: includeGroups ? groups : [],
          surveys: includeSurveys ? surveys : [],
          elements: includeElements ? elements : [],
        });
      } catch (loadError) {
        setError(loadError);
      } finally {
        setLoading(false);
      }
    },
    [
      elementsKey,
      includeElements,
      includeGroups,
      includeInactiveElements,
      includeSurveys,
    ],
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);

  return {
    groups: state.groups,
    surveys: state.surveys,
    elements: state.elements,
    loading,
    error,
    refresh,
  };
}
