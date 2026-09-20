
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
BookOpen, Search, PenLine, Bell, User, Menu, X,
Heart, LogOut, Moon, Sun, Shield, MessageCircle, Mic, Settings as SettingsIcon
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { setTheme, getEffectiveTheme } from "@/lib/theme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
const location = useLocation();
const { t } = useLanguage();
const { user, isAuthenticated, navigateToLogin, logout } = useAuth();

const [mobileOpen, setMobileOpen] = useState(false);
const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
setDarkMode(getEffectiveTheme() === "dark");


const observer = new MutationObserver(() => {
  setDarkMode(document.documentElement.classList.contains("dark"));
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});

return () => observer.disconnect();


}, []);

const toggleDark = () => {
const next = darkMode ? "light" : "dark";
setTheme(next);
setDarkMode(next === "dark");
};

const { data: unreadCount = 0 } = useQuery({
queryKey: ["unread-notifications", user?.email],
queryFn: async () => {
if (!user?.email) return 0;


  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_email", user.email)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to load unread notifications:", error);
    return 0;
  }

  return count || 0;
},
enabled: !!user?.email && isAuthenticated,
refetchInterval: 30000,


});

const navLinks = [
{ to: "/", label: t("nav.home"), icon: BookOpen },
{ to: "/explore", label: t("nav.explore"), icon: Search },
{ to: "/write", label: t("nav.write"), icon: PenLine },
{ to: "/social", label: t("nav.friends"), icon: MessageCircle },
{ to: "/favorites", label: t("nav.favorites"), icon: Heart },
{ to: "/voice-studio", label: t("nav.voiceStudio"), icon: Mic },
];

const isActive = (path) => location.pathname === path;

const handleLogout = async () => {
await logout();
};

return ( <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"> <div className="max-w-7xl mx-auto px-4 sm:px-6"> <div className="flex items-center justify-between h-16">


      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-heading font-bold text-xl tracking-tight hidden sm:block">
          Moroccan Novels
        </span>
      </Link>

      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-1">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Button
              variant={isActive(to) ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          className="hidden sm:flex"
        >
          {darkMode ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>

        {user && (
          <Link to="/notifications" className="relative">
            <Button variant="ghost" size="icon">
              <Bell className="w-4 h-4" />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </Link>
        )}

        {user ? (
          <DropdownMenu>

            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    className="w-8 h-8 rounded-full object-cover"
                    alt=""
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">

              <div className="px-3 py-2">
                <p className="font-medium text-sm">
                  {user.full_name}
                </p>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  {t("nav.myProfile")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  to="/favorites"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Heart className="w-4 h-4" />
                  {t("nav.favorites")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  to="/social"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("nav.messages")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  to="/settings"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {t("nav.settings")}
                </Link>
              </DropdownMenuItem>

              {user.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-4 h-4" />
                    {t("nav.adminPanel")}
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={toggleDark}
                className="flex items-center gap-2 cursor-pointer sm:hidden"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}

                {darkMode
                  ? t("nav.lightMode")
                  : t("nav.darkMode")}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-destructive"
              >
                <LogOut className="w-4 h-4" />
                {t("nav.logout")}
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="sm"
            onClick={navigateToLogin}
          >
            {t("nav.signIn")}
          </Button>
        )}

        <Link to="/settings" className="hidden sm:block">
          <Button
            variant="ghost"
            size="icon"
            title={t("nav.settings")}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </Link>

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </Button>

      </div>
    </div>

    {/* Mobile Nav */}
    {mobileOpen && (
      <div className="md:hidden pb-4 border-t border-border pt-3 space-y-1">

        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
          >
            <Button
              variant={isActive(to) ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          </Link>
        ))}

      </div>
    )}

  </div>
</nav>


);
}
