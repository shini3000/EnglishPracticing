'use client';

import { motion } from 'motion/react';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';

// Keep the session tree and its motion wrapper behind the same lazy boundary.
export const MotionSessionView = motion.create(AgentSessionView_01);
