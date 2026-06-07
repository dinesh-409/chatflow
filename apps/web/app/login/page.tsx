"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { FiMail, FiLock, FiUser } from "react-icons/fi";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
            const payload = isRegister ? { email, password, name } : { email, password };
            
            const res = await api.post(endpoint, payload);
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch (err: any) {
            setError(err.response?.data?.error || "Authentication failed");
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
            const res = await api.post("/api/auth/google", {
                credential: credentialResponse.credential
            });
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch (err: any) {
            setError(err.response?.data?.error || "Google Auth failed");
        }
    };

    const handleGuestLogin = async () => {
        try {
            const res = await api.post("/api/auth/guest");
            login(res.data.data.token, res.data.data.user);
            router.push("/");
        } catch (err: any) {
            setError("Guest login failed");
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0d0d0d]">
            <div className="w-full max-w-md rounded-2xl bg-[#141414] p-8 shadow-2xl border border-white/5">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Welcome to ChatFlow
                    </h1>
                    <p className="text-sm text-gray-400">
                        {isRegister ? "Create an account to continue" : "Sign in to your account"}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {isRegister && (
                        <div className="relative">
                            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Full Name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-500 outline-none focus:bg-white/10 transition-colors border border-transparent focus:border-white/20"
                            />
                        </div>
                    )}
                    <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="email"
                            placeholder="Email address"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-500 outline-none focus:bg-white/10 transition-colors border border-transparent focus:border-white/20"
                        />
                    </div>
                    <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl bg-white/5 py-3 pl-10 pr-4 text-white placeholder-gray-500 outline-none focus:bg-white/10 transition-colors border border-transparent focus:border-white/20"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-white text-black py-3 font-semibold hover:bg-gray-200 transition-colors mt-2"
                    >
                        {isRegister ? "Sign Up" : "Sign In"}
                    </button>
                </form>

                <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-white/10"></div>
                    <span className="px-4 text-xs text-gray-500">OR</span>
                    <div className="flex-1 border-t border-white/10"></div>
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
                        className="w-full rounded-xl bg-white/5 text-white py-3 font-medium hover:bg-white/10 transition-colors border border-white/10"
                    >
                        Continue as Guest
                    </button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-400">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        className="text-white hover:underline focus:outline-none"
                    >
                        {isRegister ? "Sign In" : "Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
}
