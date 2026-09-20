import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, PenLine, MessageCircle, User } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function MobileTabBar() {
  const location = useLocation();
  const { t } = useLanguage();

  const tabs = [
    { to: "/", label: t("nav.home"), icon: BookOpen },
    { to: "/explore", label: t("nav.explore"), icon: Search },
    { to: "/write", label: t("nav.write"), icon: PenLine },
    { to: "/social", label: t("nav.friends"), icon: MessageCircle },
    { to: "/profile", label: t("nav.myProfile"), icon: User },
  ];

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border pb-safe"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-stretch justify-around h-14">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 select-none"
            >
              <div
                className={`flex items-center justify-center w-9 h-7 rounded-full transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span
                className={`text-[10px] leading-none transition-colors ${
                  active ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}