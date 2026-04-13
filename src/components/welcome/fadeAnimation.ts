export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 1, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});
