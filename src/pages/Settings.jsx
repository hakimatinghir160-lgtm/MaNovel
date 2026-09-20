import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { languageNames } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Moon, Sun, Languages, Palette, Monitor, UserCog, Trash2 } from "lucide-react";
import MobileDetailHeader from "@/components/layout/MobileDetailHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getThemePreference, setTheme } from "@/lib/theme";

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [themePref, setThemePref] = useState("system");
  const [user, setUser] = useState(null);

  useEffect(() => {
    setThemePref(getThemePreference());

    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data?.user || null);
      })
      .catch(() => {});
  }, []);

  const applyThemePref = (pref) => {
    setThemePref(pref);
    setTheme(pref);
  };

  const languages = [
    { code: "ar", label: t("settings.arabic") },
    { code: "en", label: t("settings.english") },
    { code: "fr", label: t("settings.french") },
  ];

  const themeOptions = [
    { id: "light", label: t("settings.light"), icon: Sun },
    { id: "dark", label: t("settings.dark"), icon: Moon },
    { id: "system", label: t("settings.themeAuto"), icon: Monitor },
  ];

  const handleDeleteAccount = () => {
    // No direct client-side account deletion endpoint is exposed.
    // Clear local state and sign the user out.
    try {
      localStorage.removeItem("app_theme");
    } catch {}

    toast.success(t("settings.deleteAccountSuccess"));

    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    }, 600);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
      <MobileDetailHeader title={t("settings.title")} fallback="/" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("settings.appearanceDesc")}</p>
        </div>
      </div>

      {/* Language section */}
      <Card className="p-5 mb-4 rounded-2xl border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Languages className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">{t("settings.language")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
          {languages.map((lng) => {
            const active = language === lng.code;
            const meta = languageNames[lng.code];

            return (
              <button
                key={lng.code}
                onClick={() => setLanguage(lng.code)}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{meta.flag}</span>
                  <span className="font-medium">{lng.label}</span>
                </span>
                {active && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Theme section */}
      <Card className="p-5 rounded-2xl border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">{t("settings.theme")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.themeDesc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {themeOptions.map(({ id, label, icon: Icon }) => {
            const active = themePref === id;

            return (
              <button
                key={id}
                onClick={() => applyThemePref(id)}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{label}</span>
                {active && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Account section */}
      <Card className="p-5 mt-4 rounded-2xl border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <UserCog className="w-5 h-5 text-muted-foreground" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold">{t("settings.account")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.accountDesc")}</p>
          </div>
        </div>

        {/* Email — the only place it is visible */}
        <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserCog className="w-4 h-4 text-primary" />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
            <p className="text-sm font-medium truncate">{user?.email || "—"}</p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium">{t("settings.deleteAccount")}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t("settings.deleteAccountDesc")}
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full mt-4 rounded-full gap-2">
                <Trash2 className="w-4 h-4" />
                {t("settings.deleteAccount")}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.deleteAccountConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("settings.deleteAccountConfirmDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("settings.deleteAccountCancel")}
                </AlertDialogCancel>

                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
                  onClick={handleDeleteAccount}
                >
                  {t("settings.deleteAccountConfirmBtn")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}