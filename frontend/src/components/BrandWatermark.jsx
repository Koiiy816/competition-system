import React from 'react';
import { Box } from '@mui/material';

const BrandWatermark = ({ sx = {} }) => (
  <Box
    component="img"
    src="/assets/saiyitong-logo.png"
    alt=""
    aria-hidden="true"
    sx={{
      width: 180,
      maxWidth: 'none',
      pointerEvents: 'none',
      userSelect: 'none',
      mixBlendMode: 'multiply',
      ...sx,
    }}
  />
);

export default BrandWatermark;
