"use client";
// Adapted from beui.dev (MIT, https://github.com/starc007/ui-components) — https://beui.dev/components/motion/avatar-group.
// Keep animation logic close to upstream; adaptations are commented inline.
// Original component author: Saurabh <saurabh10102@gmail.com>.

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentPropsWithRef, type PointerEvent, useEffect, useState } from "react";
import { cn } from "~/shared/lib/utils";

export interface AvatarGroupMember {
  id: string;
  name: string;
  /** Image URL. Without one, or if it fails to load, initials show. */
  src?: string;
  /**
   * Adaptation (not upstream): extra classes on the avatar itself, so a caller can mark a member
   * (ring, opacity) without wrapping it. Appended after the defaults by the repo's `cn`.
   */
  className?: string;
  /**
   * Adaptation (not upstream): tooltip text when it should say more than the name.
   * Falls back to `name`, exactly like upstream.
   */
  hint?: string;
}

const SIZES = {
  sm: { box: "size-7 text-[10px]", px: 28 },
  md: { box: "size-9 text-xs", px: 36 },
  lg: { box: "size-11 text-sm", px: 44 },
} as const;

type AvatarSize = keyof typeof SIZES;

/** English defaults. Override per instance with `labels`. */
export const avatarGroupMessages = {
  label: "Crew on station",
  showFewer: "Show fewer members",
  showMore: "Show {count} more members",
};

export type AvatarGroupMessages = typeof avatarGroupMessages;

/* ----------------------------------------------------------------------------
 * Local motion tokens. Upstream imports these from `@/lib/ease`; the values are
 * copied verbatim from that file (beui.dev, MIT) so the animation is unchanged.
 * -------------------------------------------------------------------------- */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Shared-layout glides — pills, indicators and panels morphing between positions. */
export const SPRING_LAYOUT = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.6,
} as const;
/** Press feedback on buttons and other tappable surfaces. */
export const SPRING_PRESS = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

/**
 * Inlined from upstream `lib/hooks/use-hover-capable.ts` (that hook file is not vendored).
 * True only on devices with a true hover, so a touch tap does not leave the row fanned apart.
 */
function useHoverCapable() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return canHover;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export interface AvatarProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  name: string;
  src?: string;
  size?: AvatarSize;
}

/** One avatar: the image, or initials when there is no image or it fails. */
export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = src && failedSrc !== src;
  return (
    <span
      {...props}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card font-medium text-muted-foreground ring-2 ring-background select-none",
        SIZES[size].box,
        className,
      )}
    >
      {showImage ? (
        // biome-ignore lint/performance/noImgElement: a portable component; avatars come from any host and fall back to initials on error
        <img
          src={src}
          alt={name}
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <>
          <span aria-hidden="true">{initials(name)}</span>
          <span className="sr-only">{name}</span>
        </>
      )}
    </span>
  );
}

export interface AvatarGroupProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  members: AvatarGroupMember[];
  /** Avatars shown before the rest collapse into a +N count. */
  max?: number;
  size?: AvatarSize;
  /** Whether every member is shown. Pair with `onExpandedChange`. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Accessible name for the list, such as "Crew on station". */
  label?: string;
  /** Override any built-in string. `{count}` fills `showMore`. */
  labels?: Partial<AvatarGroupMessages>;
}

/**
 * Overlapping avatars that fan apart on hover, lift the one under the pointer
 * with its name, and expand from a +N count to show everyone.
 */
export function AvatarGroup({
  members,
  max = 4,
  size = "md",
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  label,
  labels,
  className,
  ...props
}: AvatarGroupProps) {
  // Adaptation: upstream resolves strings through `useMessages`/`useLocale` and formats the count
  // with `Intl`; this app has no locale on the route that uses the group, so the English defaults
  // (or the `labels` prop) are read directly and the count is a plain string.
  const t = (key: keyof AvatarGroupMessages, values?: Record<string, string | number>) => {
    const template = labels?.[key] ?? avatarGroupMessages[key];
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      values[name] === undefined ? match : String(values[name]),
    );
  };
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  // Index of the avatar under a mouse pointer; the +N button counts as the
  // last slot.
  const [hovered, setHovered] = useState<number | null>(null);

  const limit = Math.max(1, max);
  const overflow = Math.max(0, members.length - limit);
  const visible = isExpanded ? members : members.slice(0, limit);
  const px = SIZES[size].px;
  // Avatars overlap by a third of their width. Hovering one parts the row
  // around it: everything before slides back, everything after slides on,
  // so the hovered avatar shows in full while the group stays in place.
  const overlap = Math.round(px / 3);
  const push = Math.round(overlap * 0.75);
  const parting = !reduce && canHover && hovered !== null;
  const offset = (index: number) =>
    !parting || index === hovered ? 0 : index < (hovered ?? 0) ? -push : push;
  const hoverHandlers = (index: number) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse") setHovered(index);
    },
  });

  const toggle = () => {
    const next = !isExpanded;
    if (expanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  // Adaptation: upstream wraps the group in its own `TooltipProvider` (floating-ui); this is the
  // repo's existing Radix tooltip, so the provider is Radix's with the same intent.
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={300}>
      <div
        {...props}
        onPointerLeave={(event) => {
          props.onPointerLeave?.(event);
          setHovered(null);
        }}
        className={cn("inline-flex items-center", className)}
      >
        <ul aria-label={label ?? t("label")} className="relative flex items-center">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((member, index) => (
              <motion.li
                key={member.id}
                layout={reduce ? false : "position"}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: reduce ? 1 : 0.6,
                  transition: { duration: 0.14, ease: EASE_OUT },
                }}
                transition={{
                  layout: SPRING_LAYOUT,
                  scale: SPRING_LAYOUT,
                  opacity: { duration: 0.18, ease: EASE_OUT },
                }}
                // Later avatars sit on top, except the hovered one.
                style={{
                  marginLeft: index === 0 ? 0 : -overlap,
                  zIndex: parting && hovered === index ? visible.length + 1 : index,
                  position: "relative",
                }}
              >
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    {/* Adaptation: `tabIndex` so the name is reachable without a pointer. */}
                    <motion.span
                      tabIndex={0}
                      className="block rounded-full"
                      {...hoverHandlers(index)}
                      animate={{
                        x: offset(index),
                        y: parting && hovered === index ? -3 : 0,
                        scale: parting && hovered === index ? 1.06 : 1,
                      }}
                      transition={SPRING_LAYOUT}
                    >
                      <Avatar
                        name={member.name}
                        src={member.src}
                        size={size}
                        className={member.className}
                      />
                    </motion.span>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="top"
                      // 24 clears the caption line above the row, so hovering a member never hides the count.
                      sideOffset={24}
                      collisionPadding={8}
                      className="z-[100] max-w-[min(20rem,calc(100vw-16px))] rounded-md border border-white/10 bg-[#0b1220]/95 px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-(--text) shadow-lg"
                    >
                      {member.hint ?? member.name}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </motion.li>
            ))}
            {overflow > 0 ? (
              <motion.li
                key="overflow"
                layout={reduce ? false : "position"}
                transition={{ layout: SPRING_LAYOUT }}
                style={{ marginLeft: -overlap, zIndex: visible.length, position: "relative" }}
              >
                <motion.span
                  className="block"
                  {...hoverHandlers(visible.length)}
                  animate={{ x: offset(visible.length) }}
                  transition={SPRING_LAYOUT}
                >
                  <motion.button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t("showFewer") : t("showMore", { count: overflow })}
                    onClick={toggle}
                    whileTap={reduce ? undefined : { scale: 0.92 }}
                    transition={SPRING_PRESS}
                    className={cn(
                      // `rounded-full!`: the app reset's unlayered `:focus-visible` forces a 4px
                      // radius, which would flatten this circle while it has focus.
                      "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full! bg-foreground font-medium text-background tabular-nums ring-2 ring-background outline-none focus-visible:ring-ring",
                      SIZES[size].box,
                    )}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={isExpanded ? "less" : "more"}
                        aria-hidden="true"
                        initial={{ opacity: 0, y: reduce ? 0 : isExpanded ? 8 : -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduce ? 0 : isExpanded ? -8 : 8 }}
                        transition={{ duration: 0.16, ease: EASE_OUT }}
                      >
                        {isExpanded ? "−" : `+${String(overflow)}`}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </motion.span>
              </motion.li>
            ) : null}
          </AnimatePresence>
        </ul>
      </div>
    </TooltipPrimitive.Provider>
  );
}
