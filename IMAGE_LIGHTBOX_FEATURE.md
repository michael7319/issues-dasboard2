# Image Lightbox Feature

## Overview
Added a full-screen image lightbox/popup feature that displays images at 70% screen coverage when clicked, preventing redirects to new pages. Uses React Portal to render at document root level, ensuring it appears above all other content.

## Changes Made

### 1. New Component: ImageLightbox.jsx
- **Location**: `src/components/ImageLightbox.jsx`
- **Features**:
  - Full-screen overlay with 90% black opacity background
  - Image displayed at max 70% viewport width/height
  - Close button (X) in top-right corner
  - Click outside image to close
  - Click on image area prevented from closing
  - Image name displayed below the image
  - Error handling with placeholder for failed images
  - High z-index (100) to appear above modals

### 2. TaskViewModal.jsx Updates
- **Modal Width**: Increased from `max-w-3xl` to `max-w-5xl` for better viewing
- **Image Interaction**: 
  - Images are now clickable (div instead of anchor tag)
  - Click opens lightbox instead of opening in new tab
  - Hover effect: border changes from gray to purple
  - Cursor changes to pointer on hover
- **State Management**: Added `lightboxImage` state to track which image is being viewed
- **Rendering**: ImageLightbox component rendered alongside Dialog

### 3. TaskCard.jsx Updates
- **Image Interaction**:
  - Converted image links from `<a>` to `<div>` with click handler
  - Click opens lightbox via `setLightboxImage()`
  - Prevents event propagation to avoid triggering card click
  - Added purple border on hover
- **State Management**: Added `lightboxImage` state
- **Rendering**: ImageLightbox component added to return statement

## Usage

### In TaskCard
1. Hover over any image attachment → border turns purple
2. Click on image → Opens lightbox at 70% screen size
3. Click X button or click outside image → Closes lightbox

### In TaskViewModal
1. View task in modal (larger modal, max-w-5xl)
2. Images displayed at max-h-96 
3. Click any image → Opens lightbox at 70% screen size
4. Click X button or click outside image → Closes lightbox

## Technical Details

### Lightbox Positioning
- Fixed positioning covering entire viewport
- Flexbox centering (items-center justify-center)
- z-index: 100 (above modals which are typically 50)
- Background: black with 90% opacity

### Image Sizing
- Max width: 70vw (70% of viewport width)
- Max height: calc(70vh - 60px) (70% viewport height minus space for name)
- Object-fit: contain (maintains aspect ratio)
- Rounded corners and shadow for polish

### Event Handling
- Click on overlay → closes lightbox
- Click on image container → stops propagation (doesn't close)
- ESC key: Not implemented (can be added if needed)

## Keyboard Shortcuts (Future Enhancement)
- ESC: Close lightbox
- Left/Right arrows: Navigate between images in a task

## Browser Compatibility
- Uses modern CSS (flexbox, viewport units)
- Compatible with all modern browsers
- Uses Lucide React icons (already in project)

## Performance Considerations
- Lightbox only renders when `isOpen` is true
- Images are already loaded (no additional fetch)
- Minimal re-renders (state only in parent component)
