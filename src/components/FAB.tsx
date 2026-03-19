import { Plus } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  onClick: () => void;
}

const FAB = ({ onClick }: Props) => {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-fab flex items-center justify-center will-change-transform"
      style={{
        background: "linear-gradient(135deg, hsl(239, 84%, 67%) 0%, hsl(262, 83%, 58%) 100%)",
      }}
    >
      <Plus className="w-6 h-6" strokeWidth={2.5} />
    </motion.button>
  );
};

export default FAB;
