import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp } from "./fadeAnimation";
import MagneticButton from "./MagneticButton";
import SuccessMessage from "./SuccessMessage";

const ADMIN_EMAIL = "vora.support@gmail.com";

const CATEGORIES = [
  { value: "question", label: "Question" },
  { value: "feedback", label: "Feedback" },
  { value: "feature", label: "Feature Request" },
  { value: "partnership", label: "Partnership" },
] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(320),
  category: z.enum(["question", "feedback", "feature", "partnership"]),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

const WelcomeContactSection = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("question");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, category, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setLoading(true);
    try {
      const id = crypto.randomUUID();
      const payload = parsed.data;

      const { error: insertError } = await supabase
        .from("welcome_messages")
        .insert([{ id, ...payload }]);
      if (insertError) throw insertError;

      // Confirmation to visitor (non-blocking)
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "welcome-contact-confirmation",
          recipientEmail: payload.email,
          idempotencyKey: `welcome-confirm-${id}`,
          templateData: {
            name: payload.name,
            category: payload.category,
            message: payload.message,
          },
        },
      }).catch((err) => console.warn("confirmation email failed", err));

      // Notification to admin (non-blocking)
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "welcome-contact-notification",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `welcome-notify-${id}`,
          templateData: payload,
        },
      }).catch((err) => console.warn("notification email failed", err));

      setSubmitted(true);
    } catch (err: any) {
      console.error("welcome contact submit error", err);
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="get-in-touch"
      className="py-24 px-6 bg-background text-foreground border-t border-foreground/10"
    >
      <div className="max-w-xl mx-auto text-center">
        <motion.p
          {...fadeUp(0)}
          className="text-[10px] uppercase tracking-[0.35em] text-foreground/40 font-outfit mb-6"
        >
          Get in Touch
        </motion.p>
        <motion.h2
          {...fadeUp(0.08)}
          className="font-serif-display font-light text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4"
        >
          Questions, ideas, or <span className="italic">a partnership.</span>
        </motion.h2>
        <motion.p
          {...fadeUp(0.16)}
          className="font-outfit text-foreground/50 text-base md:text-lg leading-relaxed mb-12"
        >
          Tell us what's on your mind. We read every message and reply personally.
        </motion.p>

        {!submitted ? (
          <motion.form
            {...fadeUp(0.24)}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 text-left"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="contact-name" className="sr-only">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  maxLength={100}
                  disabled={loading}
                  className="w-full bg-transparent border-b border-foreground/20 focus:border-foreground py-3 text-sm font-outfit text-foreground placeholder:text-foreground/30 focus:outline-none transition-colors disabled:opacity-40"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="sr-only">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  maxLength={320}
                  disabled={loading}
                  className="w-full bg-transparent border-b border-foreground/20 focus:border-foreground py-3 text-sm font-outfit text-foreground placeholder:text-foreground/30 focus:outline-none transition-colors disabled:opacity-40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-foreground/40 font-outfit mb-3">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    disabled={loading}
                    className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-outfit border transition-colors ${
                      category === c.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20 text-foreground/60 hover:border-foreground/50"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="sr-only">Message</label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message"
                rows={5}
                maxLength={2000}
                disabled={loading}
                className="w-full bg-transparent border-b border-foreground/20 focus:border-foreground py-3 text-sm font-outfit text-foreground placeholder:text-foreground/30 focus:outline-none transition-colors disabled:opacity-40 resize-none"
              />
              <p className="mt-2 text-[10px] tracking-wider text-foreground/30 font-outfit text-right">
                {message.length}/2000
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <MagneticButton
                type="submit"
                disabled={loading}
                className="border border-foreground/60 text-foreground px-10 py-3 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium hover:bg-foreground hover:text-background transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send Message"}
              </MagneticButton>
            </div>
          </motion.form>
        ) : (
          <SuccessMessage />
        )}
      </div>
    </section>
  );
};

export default WelcomeContactSection;
