import React from "react";
import {
  Play,
  Pause,
  User,
  Trash2,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

const GENDER_STYLES = {
  female: "bg-pink-500/10 text-pink-500",
  narrator: "bg-amber-500/10 text-amber-500",
  male: "bg-blue-500/10 text-blue-500",
};

const GENDER_LABEL = {
  female: "أنثى",
  narrator: "راوي",
  male: "ذكر",
};

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

export default function CharacterVoiceCard({
  char,
  isPlaying,
  onTogglePlay,
  disabled,
  currentUserEmail,
  onDelete,
  deleting,
}) {
  const style =
    GENDER_STYLES[char.gender] || GENDER_STYLES.male;

  const label =
    GENDER_LABEL[char.gender] || "ذكر";

  const canPlay =
    !disabled &&
    !deleting &&
    Boolean(char.sample_audio_url || char.voice_id);

  // التحقق من صاحب الشخصية عن طريق البريد الإلكتروني
  const characterOwnerEmail = normalizeEmail(
    char.author_email
  );

  const currentEmail = normalizeEmail(
    currentUserEmail
  );

  const isOwner =
    Boolean(characterOwnerEmail) &&
    Boolean(currentEmail) &&
    characterOwnerEmail === currentEmail;

  const canDelete =
    isOwner &&
    typeof onDelete === "function" &&
    !deleting;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${style}`}
      >
        {char.name?.[0]?.toUpperCase() || (
          <User className="w-5 h-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">
            {char.name}
          </span>

          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style}`}
          >
            {label}
          </span>
        </div>

        {char.voice_name && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {char.voice_name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(char)}
            disabled={deleting}
            aria-label={`حذف شخصية ${char.name}`}
            title="حذف الشخصية"
            className="w-9 h-9 flex items-center justify-center rounded-full text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => onTogglePlay(char)}
          disabled={!canPlay}
          aria-label={
            isPlaying
              ? `إيقاف صوت ${char.name}`
              : `تشغيل صوت ${char.name}`
          }
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isPlaying
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              إيقاف
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              استماع
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}