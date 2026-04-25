import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MfaLevel = "aal1" | "aal2";

export interface MfaFactor {
  id: string;
  friendlyName?: string;
  factorType: "totp" | "phone";
  status: "unverified" | "verified";
}

export interface MfaEnrollResult {
  factorId: string;
  qrCode: string;
  secret: string;
  oldFactorId?: string;
}

export function useMfa() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<MfaLevel>("aal1");
  const [nextLevel, setNextLevel] = useState<MfaLevel>("aal1");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: levelData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setCurrentLevel((levelData?.currentLevel as MfaLevel) ?? "aal1");
      setNextLevel((levelData?.nextLevel as MfaLevel) ?? "aal1");

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors: MfaFactor[] =
        factorsData?.totp?.map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name,
          factorType: "totp",
          status: f.status,
        })) ?? [];
      setFactors(totpFactors);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enrollTotp = useCallback(async (friendlyName = "Authenticator"): Promise<MfaEnrollResult> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });
    if (error || !data) throw error ?? new Error("Falha ao iniciar enroll");
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  }, []);

  const verifyTotp = useCallback(
    async (factorId: string, code: string) => {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw challengeError ?? new Error("Falha ao criar challenge");

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      await refresh();
    },
    [refresh]
  );

  const unenroll = useCallback(
    async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const resetAllFactors = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const all = [...(data?.totp ?? []), ...(data?.phone ?? [])];
    for (const f of all) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) throw error;
    }
    await refresh();
  }, [refresh]);

  // Remove apenas fatores não verificados (preserva o fator verificado ativo)
  const unenrollPending = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const pending = (data?.totp ?? []).filter((f) => f.status === "unverified");
    for (const f of pending) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) throw error;
    }
    await refresh();
  }, [refresh]);

  return {
    loading,
    factors,
    currentLevel,
    nextLevel,
    hasVerifiedFactor: factors.some((f) => f.status === "verified"),
    mfaRequired: nextLevel === "aal2" && currentLevel === "aal1",
    refresh,
    enrollTotp,
    verifyTotp,
    unenroll,
    resetAllFactors,
    unenrollPending,
  };
}
