"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/home");
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-body-md relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/20 rounded-full blur-3xl mix-blend-multiply"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[448px] w-full relative z-10 text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Exortic AI" width={48} height={48} className="w-full h-full object-contain" priority />
          </div>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-primary font-headline-md tracking-tight">
          Exortic <span className="text-secondary">AI</span>
        </h2>
        <p className="mt-2 text-center text-sm text-on-surface-variant">
          Advanced Socratic AI Learning Engine
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[448px] relative z-10">
        <div className="bg-surface/80 backdrop-blur-md py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-outline-variant">
          
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold text-primary">Log In</h3>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-on-surface">Email address</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline-variant text-lg">mail</span>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest placeholder-outline text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="admin@guied.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline-variant text-lg">lock</span>
                </div>
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest placeholder-outline text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="text-outline-variant hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {show ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-error text-sm bg-error-container/20 border border-error/50 p-2 rounded-md">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-outline-variant pt-4 text-center">
            <p className="text-sm text-on-surface-variant">
              Don&apos;t have an account?{" "}
              <Link 
                href="/signup" 
                className="font-medium text-secondary hover:text-primary transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}