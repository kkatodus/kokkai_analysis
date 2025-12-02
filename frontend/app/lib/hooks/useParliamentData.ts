/**
 * React hooks for fetching parliament data
 * Provides loading states, error handling, and automatic refetching
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchPoliticians,
  fetchTopics,
  fetchPrefectures,
  fetchNetworkEdges,
  fetchComments,
  fetchPoliticianById,
} from "@/app/lib/services/dataService";
import type {
  Politician,
  Topic,
  NetworkEdge,
  Prefecture,
  Comment,
} from "@/app/types";

interface UseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching politicians
 */
export function usePoliticians(): UseDataResult<Politician[]> {
  const [data, setData] = useState<Politician[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPoliticians();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch politicians"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching topics
 */
export function useTopics(): UseDataResult<Topic[]> {
  const [data, setData] = useState<Topic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchTopics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch topics"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching prefectures
 */
export function usePrefectures(): UseDataResult<Prefecture[]> {
  const [data, setData] = useState<Prefecture[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPrefectures();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch prefectures"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching network edges
 */
export function useNetworkEdges(): UseDataResult<NetworkEdge[]> {
  const [data, setData] = useState<NetworkEdge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchNetworkEdges();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch network edges"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching comments for a specific politician
 */
export function useComments(politicianId: string | null): UseDataResult<Comment[]> {
  const [data, setData] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!politicianId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchComments(politicianId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch comments"));
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching a single politician by ID
 */
export function usePolitician(id: string | null): UseDataResult<Politician | null> {
  const [data, setData] = useState<Politician | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchPoliticianById(id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch politician"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

