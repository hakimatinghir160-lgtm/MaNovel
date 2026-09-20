import React from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Visual indicator for pull-to-refresh. Place at the top inside the scroll container.
export default function PullToRefreshIndicator({ pull, refreshing }) {
  const { t } = useLanguage();
  const threshold = 70;
  const ready = pull >= threshold;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all"
      style={{ height: refreshing ? 48 : pull }}
    >
      {refreshing ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>{t("pullToRefresh.refreshing")}</span>
        </div>
      ) : pull > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowDown
            className={`w-4 h-4 text-primary transition-transform ${ready ? "rotate-180" : ""}`}
          />
          <span>{ready ? t("pullToRefresh.release") : t("pullToRefresh.pull")}</span>
        </div>
      ) : null}
    </div>
  );
}