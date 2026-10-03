export const easings = {
  entrance: [0.22, 1, 0.36, 1] as const,
};

export const durations = {
  entrance: 0.5,
  stagger: 0.06,
  micro: 0.15,
  chipPop: 0.18
};

export const variants = {
  fadeUp: {
    initial: { opacity: 0, y: 12 },
    animate: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: durations.entrance, ease: easings.entrance } 
    }
  }
};
