import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ShieldCheck, UserPlus, LogIn, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AuthPage() {
    const { user, loginMutation, registerMutation } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("login");

    if (user) {
        setLocation("/");
        return null;
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2 animate-in fade-in duration-700">
            <div className="flex items-center justify-center p-8 bg-background relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

                <Card className="w-full max-w-md glass-morphism border-white/20 shadow-2xl relative z-10 rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="space-y-4 pt-10 px-8 text-center">
                        <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-2 border border-primary/20 shadow-inner rotate-3">
                            <ShieldCheck className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                            ScrapeFlow
                        </CardTitle>
                        <CardDescription className="text-lg font-medium text-muted-foreground">
                            Intelligence CRM Platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-10">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 rounded-2xl h-14">
                                <TabsTrigger value="login" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-lg">
                                    <LogIn className="w-4 h-4 mr-2" /> Login
                                </TabsTrigger>
                                <TabsTrigger value="register" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-lg">
                                    <UserPlus className="w-4 h-4 mr-2" /> Register
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="login">
                                <AuthForm
                                    mode="login"
                                    onSubmit={(data) => loginMutation.mutate(data)}
                                    isLoading={loginMutation.isPending}
                                />
                            </TabsContent>

                            <TabsContent value="register">
                                <AuthForm
                                    mode="register"
                                    onSubmit={(data) => {
                                        registerMutation.mutate(data, {
                                            onSuccess: () => {
                                                toast({
                                                    title: "Registration successful!",
                                                    description: "You can now login with your credentials.",
                                                    className: "bg-green-50 border-green-200 text-green-800",
                                                });
                                                setActiveTab("login");
                                            }
                                        });
                                    }}
                                    isLoading={registerMutation.isPending}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden">
                {/* Dynamic background patterns */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3" />

                <div className="relative z-10 max-w-xl mx-auto space-y-12">
                    <div className="space-y-6">
                        <h1 className="text-6xl font-black leading-tight tracking-tighter">
                            Scale Your Scraping <br />Operations.
                        </h1>
                        <p className="text-2xl text-primary-foreground/80 font-medium leading-relaxed">
                            The all-in-one CRM designed for high-volume lead extraction and intelligent monitoring.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 pt-8">
                        <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20">
                            <h3 className="text-2xl font-bold mb-2">99.9%</h3>
                            <p className="text-primary-foreground/60 font-medium uppercase tracking-widest text-xs">Uptime Guaranteed</p>
                        </div>
                        <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20">
                            <h3 className="text-2xl font-bold mb-2">1M+</h3>
                            <p className="text-primary-foreground/60 font-medium uppercase tracking-widest text-xs">Tasks Processed</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AuthForm({ mode, onSubmit, isLoading }: { mode: 'login' | 'register', onSubmit: (data: InsertUser) => void, isLoading: boolean }) {
    const form = useForm<InsertUser>({
        resolver: zodResolver(insertUserSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-bold text-foreground/80 ml-1">Username</Label>
                <Input
                    id="username"
                    {...form.register("username")}
                    className="h-14 rounded-2xl bg-secondary/30 border-white/40 focus:ring-primary/20 focus:border-primary transition-all text-base px-6 font-medium"
                    placeholder="Enter your username"
                />
                {form.formState.errors.username && (
                    <p className="text-xs text-destructive font-bold ml-1">{form.formState.errors.username.message}</p>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="password" title="password" className="text-sm font-bold text-foreground/80 ml-1">Password</Label>
                <Input
                    id="password"
                    type="password"
                    {...form.register("password")}
                    className="h-14 rounded-2xl bg-secondary/30 border-white/40 focus:ring-primary/20 focus:border-primary transition-all text-base px-6 font-medium"
                    placeholder="••••••••"
                />
                {form.formState.errors.password && (
                    <p className="text-xs text-destructive font-bold ml-1">{form.formState.errors.password.message}</p>
                )}
            </div>
            <Button
                type="submit"
                className={cn(
                    "w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]",
                    mode === 'register' ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" : "bg-primary hover:bg-primary/90"
                )}
                disabled={isLoading}
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                    mode === 'login' ? "Sign In" : "Create Account"
                )}
            </Button>
        </form>
    );
}
