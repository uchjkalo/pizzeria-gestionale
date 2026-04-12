"use client";

import { useEffect, useState } from "react";
import { onAuthChange } from "@/lib/auth";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      if (!u) router.push("/");
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  return { user, loading };
};