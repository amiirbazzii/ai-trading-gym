"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Activity, ShieldCheck, Zap, BarChart3 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);

    const supabase = createClient();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Check your email for the confirmation link!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                toast.success("Logged in successfully!");
                router.refresh();
                router.push("/dashboard");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-muted/30">
            {/* Left Side: Branding/Marketing */}
            <div className="hidden lg:flex flex-col justify-center flex-1 p-12 bg-primary text-primary-foreground">
                <div className="max-w-md space-y-8">
                    <div className="space-y-2">
                        <Activity className="h-12 w-12" />
                        <h2 className="text-4xl font-extrabold tracking-tight">AI Trading Gym</h2>
                        <p className="text-xl text-primary-foreground/80">
                            The playground for testing your AI trading strategies with zero risk.
                        </p>
                    </div>

                    <div className="space-y-6 pt-8">
                        <div className="flex items-start gap-4">
                            <Zap className="h-6 w-6 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Instant Attribution</h3>
                                <p className="text-primary-foreground/70 text-sm">Tag trades to specific AI models and track performance in real-time.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <BarChart3 className="h-6 w-6 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Advanced Analytics</h3>
                                <p className="text-primary-foreground/70 text-sm">Deep dive into win rates, drawdowns, and risk-adjusted returns.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <ShieldCheck className="h-6 w-6 mt-1" />
                            <div>
                                <h3 className="font-bold text-lg">Zero-Risk Simulation</h3>
                                <p className="text-primary-foreground/70 text-sm">Paper trade with live ETH prices without connecting a wallet.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="flex items-center justify-center flex-1 p-6 md:p-12">
                <Card className="w-full max-w-md border-none shadow-2xl bg-background/80 backdrop-blur-sm">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-3xl font-bold">{isSignUp ? "Create an account" : "Welcome back"}</CardTitle>
                        <CardDescription>
                            {isSignUp
                                ? "Enter your email below to create your account"
                                : "Enter your email and password to access your dashboard"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    className="h-12 border-muted-foreground/20"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-12 border-muted-foreground/20"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" size="lg" className="w-full font-bold shadow-lg shadow-primary/20" disabled={loading}>
                                {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
                            </Button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                                </div>
                            </div>

                            <div className="text-center text-sm">
                                <button
                                    type="button"
                                    className="text-primary font-semibold hover:underline"
                                    onClick={() => setIsSignUp(!isSignUp)}
                                >
                                    {isSignUp
                                        ? "Already have an account? Sign In"
                                        : "Don't have an account? Sign Up"}
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
