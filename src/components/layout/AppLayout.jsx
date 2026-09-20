import React from "react";
import { Outlet, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar";
import MobileTabBar from "./MobileTabBar";
import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const { t } = useLanguage();
  const isReader = location.pathname.includes("/chapter/");

  return (
    <div className="min-h-screen bg-background">
      {!isReader && <Navbar />}
      <main>
        {isReader ? (
          <Outlet />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!isReader && <MobileTabBar />}
      {!isReader && (
        <footer className="border-t border-border/50 py-10 mt-16 md:block hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="font-heading font-bold text-base">
                  Darija<span className="text-primary">Stories</span>
                </span>
              </Link>
              <div className="text-center sm:text-right">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} روايات مغربية — {t("footer.tagline")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {t("footer.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </footer>
      )}
      {/* Mobile bottom padding for fixed nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
}