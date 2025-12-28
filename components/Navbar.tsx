"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        checkUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (_event === 'SIGNED_OUT') {
                router.push('/login');
                router.refresh();
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success("Logged out");
        router.refresh();
    };

    const links = [
        { href: "/dashboard", label: "Dashboard", protected: true },
        { href: "/trades/create", label: "New Trade", protected: true },
    ];

    return (
        <nav className="border-b">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/dashboard" className="font-bold text-xl">
                    AI Trading Gym
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-6 items-center">
                    {user && links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-primary",
                                pathname === link.href
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}

                    {user ? (
                        <Button variant="ghost" onClick={handleLogout}>Logout</Button>
                    ) : (
                        <Link href="/login">
                            <Button variant="default">Login</Button>
                        </Link>
                    )}
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-6 w-6" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <div className="flex flex-col gap-4 mt-8">
                                {user && links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "text-lg font-medium transition-colors hover:text-primary",
                                            pathname === link.href
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                {user ? (
                                    <Button variant="ghost" onClick={() => { handleLogout(); setOpen(false); }}>Logout</Button>
                                ) : (
                                    <Link href="/login" onClick={() => setOpen(false)}>
                                        <Button className="w-full">Login</Button>
                                    </Link>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
