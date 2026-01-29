"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Activity, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [success, setSuccess] = useState(false);

    const supabase = createClient();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // Determine the base URL dynamically or fallback to localhost
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });

            if (error) throw error;

            setSuccess(true);
            toast.success("Password reset link sent to your email!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-muted/30">
            {/* Left Side: Branding */}
            <div className="hidden lg:flex flex-col justify-center flex-1 p-12 bg-primary text-primary-foreground">
                <div className="max-w-md space-y-8">
                    <div className="space-y-2">
                        <Activity className="h-12 w-12" />
                        <h2 className="text-4xl font-extrabold tracking-tight">AI Trading Gym</h2>
                        <p className="text-xl text-primary-foreground/80">
                            Secure your account and get back to testing your strategies.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Form */}
            <div className="flex items-center justify-center flex-1 p-6 md:p-12">
                <Card className="w-full max-w-md border-none shadow-2xl bg-background/80 backdrop-blur-sm">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-3xl font-bold">Forgot Password</CardTitle>
                        <CardDescription>
                            Enter your email to receive a password reset link.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-6 text-center">
                                <div className="flex justify-center">
                                    <div className="rounded-full bg-green-100 p-3">
                                        <Mail className="h-8 w-8 text-green-600" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-xl">Check your email</h3>
                                    <p className="text-muted-foreground">
                                        We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
                                    </p>
                                </div>
                                <Button asChild className="w-full" variant="outline">
                                    <Link href="/login">Return to Login</Link>
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-4">
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
                                <Button type="submit" size="lg" className="w-full font-bold shadow-lg shadow-primary/20" disabled={loading}>
                                    {loading ? "Sending Link..." : "Send Reset Link"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                    {!success && (
                        <CardFooter className="flex justify-center border-t p-6">
                            <Link href="/login" className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Login
                            </Link>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
