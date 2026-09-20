import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, PenLine, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function HeroSection() {
  const { t, dir } = useLanguage();
  return (
    <section className="relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />

      <div className="max-w-7xl mx-auto sm:px-6 sm:py-24 lg:py-32 relative px-3 py-5">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}>
            
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {t("hero.badge")}
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-center whitespace-nowrap">{t("hero.title")}


            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-xl leading-relaxed hidden">
              Write in Arabic, Darija, or French. Connect with readers across Morocco and the Arab world. Your story matters.
            </p>

            <div className="flex flex-wrap gap-3 mt-8 justify-center">
              <Link to="/explore">
                <Button size="lg" className="gap-2 rounded-full px-6">
                  <BookOpen className="w-5 h-5" />
                  {t("hero.startReading")}
                  <ArrowRight className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Button>
              </Link>
              <Link to="/write">
                <Button size="lg" variant="outline" className="gap-2 rounded-full px-6">
                  <PenLine className="w-5 h-5" />
                  {t("hero.startWriting")}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex gap-8 mt-12 pt-8 border-t border-border hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}>
            
            <div>
              <p className="text-2xl sm:text-3xl font-heading font-bold text-primary">3</p>
              <p className="text-sm text-muted-foreground mt-1">{t("hero.languages")}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-heading font-bold text-primary">7</p>
              <p className="text-sm text-muted-foreground mt-1">{t("hero.genres")}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-heading font-bold text-primary">∞</p>
              <p className="text-sm text-muted-foreground mt-1">{t("hero.storiesToTell")}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>);

}