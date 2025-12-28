"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, Activity, LogOut, LayoutDashboard, PlusCircle } from "lucide-react";
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
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/trades/create", label: "New Trade", icon: PlusCircle },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
                    <Activity className="h-6 w-6 text-primary" />
                    <span>AI Trading Gym</span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-8 items-center">
                    {user && (
                        <div className="flex gap-1">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all hover:bg-accent",
                                        pathname === link.href
                                            ? "text-primary bg-primary/5"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <link.icon className="h-4 w-4" />
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-4 pl-4 border-l">
                        {user ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="text-muted-foreground hover:text-destructive gap-2"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </Button>
                        ) : (
                            <Link href="/login">
                                <Button size="sm" className="px-6 shadow-sm">Sign In</Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-accent">
                                <Menu className="h-6 w-6" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                            <div className="flex flex-col gap-6 mt-10">
                                <div className="space-y-1">
                                    <h2 className="px-2 text-lg font-semibold tracking-tight mb-4">Navigation</h2>
                                    {user && links.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all",
                                                pathname === link.href
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            <link.icon className="h-5 w-5" />
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                                <div className="mt-auto pt-6 border-t">
                                    {user ? (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start gap-3 h-12 text-destructive border-destructive/20 hover:bg-destructive/10"
                                            onClick={() => { handleLogout(); setOpen(false); }}
                                        >
                                            <LogOut className="h-5 w-5" />
                                            Logout
                                        </Button>
                                    ) : (
                                        <Link href="/login" onClick={() => setOpen(false)}>
                                            <Button className="w-full h-12 shadow-lg">Sign In</Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
