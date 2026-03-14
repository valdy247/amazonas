"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const phoneRegex = /^\+?[0-9()\-\s]{8,20}$/;

type ApiResponse = {
  error?: string;
  data?: {
    user?: { id?: string | null };
    access_token?: string;
    refresh_token?: string;
  };
};

export function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = useMemo(() => (params.get("mode") === "signup" ? "signup" : "signin"), [params]);
  const createdOk = params.get("created") === "1";

  function humanizeAuthError(raw: string) {
    const msg = raw.toLowerCase();
    if (msg.includes("email rate limit exceeded")) return "Limite temporal de email en Supabase. Espera un minuto y vuelve a intentar.";
    if (msg.includes("user already registered")) return "Ese correo ya esta registrado. Inicia sesion.";
    if (msg.includes("email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesion.";
    if (msg.includes("invalid login credentials")) return "Correo o contrasena incorrectos.";
    return raw;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formElement = event.currentTarget;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();

    try {
      if (mode === "signup") {
        if (!firstName || !lastName) return setError("Debes ingresar nombre y apellidos."), void setLoading(false);
        if (!phoneRegex.test(phone)) return setError("Numero de telefono invalido."), void setLoading(false);
        if (password.length < 8) return setError("La contrasena debe tener al menos 8 caracteres."), void setLoading(false);
        if (password !== confirmPassword) return setError("Las contrasenas no coinciden."), void setLoading(false);

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            data: { first_name: firstName, last_name: lastName, phone, full_name: fullName },
          }),
        });

        const json = (await res.json()) as ApiResponse;

        if (!res.ok || json.error) {
          setError(humanizeAuthError(json.error || "No se pudo crear la cuenta"));
          return;
        }

        if (!json.data?.user?.id) {
          setError("No se pudo confirmar la creacion de la cuenta. Intenta de nuevo.");
          return;
        }

        formElement.reset();
        router.replace(`/auth?mode=signin&created=1&email=${encodeURIComponent(email)}`);
        return;
      }

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = (await res.json()) as ApiResponse;

      if (!res.ok || json.error) {
        setError(humanizeAuthError(json.error || "No se pudo iniciar sesion"));
        return;
      }

      const accessToken = json.data?.access_token;
      const refreshToken = json.data?.refresh_token;

      if (!accessToken || !refreshToken) {
        setError("No se recibio sesion valida.");
        return;
      }

      const supabase = createClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        setError("Sesion creada pero no se pudo guardar localmente.");
        return;
      }

      router.push("/dashboard");
      return;
    } catch {
      setError("No se pudo conectar con el servidor. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full space-y-4 p-4" noValidate>
      <h1 className="text-2xl font-bold">{mode === "signup" ? "Crear cuenta" : "Iniciar sesion"}</h1>

      {createdOk ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Tu cuenta se ha creado satisfactoriamente. Ahora inicia sesion.
        </p>
      ) : null}

      {mode === "signup" ? (
        <div className="grid gap-3">
          <input className="input" name="first_name" placeholder="Nombre" required />
          <input className="input" name="last_name" placeholder="Apellidos" required />
          <input className="input" name="phone" placeholder="Telefono" required />
        </div>
      ) : null}

      <input
        className="input"
        name="email"
        placeholder="Correo"
        type="email"
        required
        defaultValue={params.get("email") || ""}
      />
      <input className="input" name="password" placeholder="Contrasena" type="password" minLength={8} required />
      {mode === "signup" ? (
        <input
          className="input"
          name="confirm_password"
          placeholder="Confirmar contrasena"
          type="password"
          minLength={8}
          required
        />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Procesando..." : mode === "signup" ? "Crear cuenta" : "Entrar"}
      </button>
    </form>
  );
}
