import React, { useState, useEffect, useRef } from 'react';
import { User, CreditCard, Clock, ChevronLeft, ChevronRight, Shield, Calendar } from 'lucide-react';

/**
 * Carousel Navigation Dots Component
 * Renders interactive dots for navigating between carousel slides
 */
const CarouselDots = ({ totalSlides, activeSlide, setActiveSlide }) => (
  <div className="carousel-dots">
    {Array.from({ length: totalSlides }).map((_, index) => (
      <button
        key={index}
        onClick={() => setActiveSlide(index)}
        className={`carousel-dot ${activeSlide === index ? 'active' : ''}`}
        aria-label={`Go to slide ${index + 1}`}
        aria-current={activeSlide === index ? 'true' : 'false'}
      />
    ))}
  </div>
);

/**
 * EmployeeProfileCarousel Component
 * A reusable carousel component for displaying employee profile sections
 */
const EmployeeProfileCarousel = ({
  activeSlide,
  setActiveSlide,
  totalSlides,
  renderSlideContent,
  slideData,
  customIcons,
  customTitles
}) => {
  // Use refs to access DOM elements
  const carouselWrapperRef = useRef(null);
  const slideRefs = useRef([]);
  
  // Set up slide references
  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, totalSlides);
  }, [totalSlides]);

  // Get default icon for the current slide
  const getDefaultIcon = (index) => {
    switch (index) {
      case 0:
        return <User size={20} className="mr-2" />;
      case 1:
        return <CreditCard size={20} className="mr-2" />;
      case 2:
        return <Clock size={20} className="mr-2" />;
      case 3:
        return <Shield size={20} className="mr-2" />;
      case 4:
        return <Calendar size={20} className="mr-2" />;
      default:
        return null;
    }
  };

  // Get icon for the current slide, using custom icons if provided
  const getSlideIcon = (index) => {
    // If custom icons provided, use them
    if (customIcons && customIcons[index]) {
      return customIcons[index];
    }
    
    // Default icons based on index
    return getDefaultIcon(index);
  };

  // Get color for the current slide's icon
  const getIconColor = () => {
    switch (activeSlide) {
      case 0:
        return "#60A5FA"; // Blue for Personal Info
      case 1:
        return "#34D399"; // Green for ID Card
      case 2:
        return "#FBBF24"; // Yellow for Attendance
      case 3:
        return "#F87171"; // Red for additional slides
      case 4:
        return "#A78BFA"; // Purple for additional slides
      default:
        return "#60A5FA"; // Default blue
    }
  };

  // Get default title for the current slide
  const getDefaultTitle = () => {
    switch (activeSlide) {
      case 0:
        return "Personal Information";
      case 1:
        return "ID Card";
      case 2:
        return "Attendance Records";
      case 3:
        return "Additional Information";
      case 4:
        return "Schedule";
      default:
        return `Slide ${activeSlide + 1}`;
    }
  };

  // Get title for the current slide, using custom titles if provided
  const getSlideTitle = () => {
    if (customTitles && customTitles[activeSlide]) {
      return customTitles[activeSlide];
    }
    return getDefaultTitle();
  };

  // Navigation functions
  const nextSlide = () => {
    setActiveSlide((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [totalSlides]); // eslint-disable-line react-hooks/exhaustive-deps

  // Allow swipe navigation on touch devices
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      // Swipe left, go to next slide
      nextSlide();
    } else if (touchEndX.current - touchStartX.current > 50) {
      // Swipe right, go to previous slide
      prevSlide();
    }
  };

  return (
    <div className="carousel-outer" role="region" aria-label="Employee profile carousel">
      {/* Carousel Header with Navigation */}
      <div className="carousel-header">
        <button 
          onClick={prevSlide}
          className="carousel-arrow-btn"
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>
        
        <h3 className="carousel-title">
          {React.cloneElement(getSlideIcon(activeSlide), { color: getIconColor() })}
          {getSlideTitle()}
        </h3>
        
        <button 
          onClick={nextSlide}
          className="carousel-arrow-btn"
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      {/* Navigation Dots */}
      <CarouselDots 
        totalSlides={totalSlides} 
        activeSlide={activeSlide} 
        setActiveSlide={setActiveSlide} 
      />
      
      {/* Carousel Content */}
      <div 
        className="carousel-wrapper" 
        ref={carouselWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="tablist"
      >
        {Array.from({ length: totalSlides }).map((_, index) => (
          <div 
            key={index}
            ref={el => slideRefs.current[index] = el}
            className={`carousel-slide ${activeSlide === index ? 'active' : ''}`}
            role="tabpanel"
            aria-hidden={activeSlide !== index}
            id={`slide-${index}`}
            tabIndex={activeSlide === index ? 0 : -1}
          >
            {renderSlideContent(index, slideData)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeProfileCarousel;