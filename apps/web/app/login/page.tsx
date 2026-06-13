"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();

    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
            const payload = isRegister ? { email, password, name } : { email, password };
            const res = await api.post(endpoint, payload);
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setError(axiosErr.response?.data?.error || "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        try {
            const res = await api.post("/api/auth/google", {
                credential: credentialResponse.credential
            });
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { error?: string } } };
            setError(axiosErr.response?.data?.error || "Google Auth failed");
        }
    };

    const handleGuestLogin = async () => {
        setIsLoading(true);
        try {
            const res = await api.post("/api/auth/guest");
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch {
            setError("Guest login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
            {/* Background gradient */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md rounded-2xl bg-[#111111] p-8 shadow-2xl border border-gray-800/80">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/20">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                        Welcome to ChatFlow
                    </h1>
                    <p className="text-sm text-gray-500">
                        {isRegister ? "Create your account" : "Sign in to continue"}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-3">
                    {isRegister && (
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <input
                                type="text"
                                placeholder="Full Name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-600 outline-none focus:bg-white/8 transition border border-gray-800 focus:border-gray-600"
                            />
                        </div>
                    )}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <input
                            type="email"
                            placeholder="Email address"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-600 outline-none focus:bg-white/8 transition border border-gray-800 focus:border-gray-600"
                        />
                    </div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-600 outline-none focus:bg-white/8 transition border border-gray-800 focus:border-gray-600"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 font-semibold hover:from-blue-500 hover:to-cyan-500 transition mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : (
                            isRegister ? "Create Account" : "Sign In"
                        )}
                    </button>
                </form>

                <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-gray-800" />
                    <span className="px-4 text-xs text-gray-600">OR</span>
                    <div className="flex-1 border-t border-gray-800" />
                </div>

                <div className="flex flex-col space-y-3">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError("Google login failed")}
                            theme="filled_black"
                            shape="pill"
                            width="300"
                        />
                    </div>

                    <button
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                        className="w-full rounded-xl bg-white/5 text-gray-300 py-3 font-medium hover:bg-white/8 hover:text-white transition border border-gray-800 hover:border-gray-700 disabled:opacity-50"
                    >
                        Continue as Guest
                    </button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-500">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        onClick={() => { setIsRegister(!isRegister); setError(""); }}
                        className="text-blue-400 hover:text-blue-300 focus:outline-none transition"
                    >
                        {isRegister ? "Sign In" : "Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
}
