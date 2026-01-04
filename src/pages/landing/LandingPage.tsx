import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    Heart,
    Shield,
    Users,
    Video,
    Calendar,
    MessageSquare,
    Star,
    ArrowRight,
    Sparkles,
    CheckCircle,
    Twitter,
    Facebook,
    Instagram,
    Linkedin,
} from 'lucide-react';
import '../../styles/landing.css';

/**
 * Landing Page Component
 */
export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: Heart,
            title: 'Personalized Care',
            description: 'Treatment plans tailored to your unique needs, goals, and preferences for optimal mental wellness.',
        },
        {
            icon: Video,
            title: 'Virtual Sessions',
            description: 'Connect with licensed therapists from the comfort of your home through secure video calls.',
        },
        {
            icon: Shield,
            title: 'HIPAA Compliant',
            description: 'Your privacy matters. All sessions and data are protected with enterprise-grade security.',
        },
        {
            icon: Calendar,
            title: 'Flexible Scheduling',
            description: 'Book sessions that fit your schedule with easy online booking and reminders.',
        },
        {
            icon: MessageSquare,
            title: 'Secure Messaging',
            description: 'Stay connected with your care team through encrypted messaging between sessions.',
        },
        {
            icon: Users,
            title: 'Group Therapy',
            description: 'Join supportive group sessions led by experienced therapists to share and grow together.',
        },
    ];

    const steps = [
        { number: 1, title: 'Sign Up', description: 'Create your account in minutes' },
        { number: 2, title: 'Get Matched', description: 'We match you with the right therapist' },
        { number: 3, title: 'Book Session', description: 'Choose a time that works for you' },
        { number: 4, title: 'Start Healing', description: 'Begin your wellness journey' },
    ];

    const testimonials = [
        {
            content: "Treat Health transformed my life. The therapists are incredibly supportive and the platform makes it so easy to stay consistent with my mental health care.",
            name: 'Sarah M.',
            role: 'Client since 2023',
            initials: 'SM',
        },
        {
            content: "As someone with a busy schedule, the flexibility of virtual sessions has been a game-changer. I've made more progress in 6 months than years of traditional therapy.",
            name: 'Michael R.',
            role: 'Client since 2024',
            initials: 'MR',
        },
        {
            content: "The care team genuinely cares about my wellbeing. The secure messaging feature helps me stay connected even between sessions.",
            name: 'Emily K.',
            role: 'Client since 2023',
            initials: 'EK',
        },
    ];

    return (
        <div className="landing-page">
            {/* Navbar */}
            <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
                <Link to="/" className="navbar-logo">
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                        <circle cx="20" cy="20" r="18" stroke="url(#navGrad)" strokeWidth="2" fill="none" />
                        <path
                            d="M20 8C20 8 10 14 10 22C10 28.075 14.925 33 21 33C27.075 33 32 28.075 32 22C32 14 20 8 20 8Z"
                            fill="url(#navGrad)"
                        />
                        <circle cx="20" cy="20" r="4" fill="white" />
                        <defs>
                            <linearGradient id="navGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#667eea" />
                                <stop offset="1" stopColor="#764ba2" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span>Treat Health</span>
                </Link>

                <div className="navbar-links">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How It Works</a>
                    <a href="#testimonials">Testimonials</a>
                    <a href="#pricing">Pricing</a>
                </div>

                <div className="navbar-actions">
                    <Link to="/login" className="btn btn-ghost">Sign In</Link>
                    <Link to="/get-started" className="btn btn-primary">Get Started</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-container">
                    <div className="hero-content">
                        <div className="hero-badge">
                            <Sparkles size={16} />
                            <span>Trusted by 10,000+ clients</span>
                        </div>
                        <h1 className="hero-title">
                            Your Journey to <span>Mental Wellness</span> Starts Here
                        </h1>
                        <p className="hero-description">
                            Connect with licensed therapists who understand you. Get personalized
                            care through secure video sessions, anytime, anywhere.
                        </p>
                        <div className="hero-actions">
                            <Link to="/get-started" className="btn btn-primary btn-lg">
                                Start Your Journey
                                <ArrowRight size={18} />
                            </Link>
                            <a href="#how-it-works" className="btn btn-secondary btn-lg">
                                Learn More
                            </a>
                        </div>
                        <div className="hero-stats">
                            <div className="hero-stat">
                                <div className="hero-stat-value">500+</div>
                                <div className="hero-stat-label">Licensed Therapists</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-value">98%</div>
                                <div className="hero-stat-label">Client Satisfaction</div>
                            </div>
                            <div className="hero-stat">
                                <div className="hero-stat-value">24/7</div>
                                <div className="hero-stat-label">Support Available</div>
                            </div>
                        </div>
                    </div>

                    <div className="hero-image">
                        {/* Decorative card elements */}
                        <div className="hero-image-float hero-image-float-1">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={24} color="var(--success-500)" />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Session Confirmed</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Tomorrow, 10:00 AM</div>
                                </div>
                            </div>
                        </div>
                        <div className="hero-image-float hero-image-float-2">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Heart size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Feeling Better</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Progress: 85%</div>
                                </div>
                            </div>
                        </div>

                        {/* Main illustration card */}
                        <div style={{
                            background: 'var(--gradient-bg)',
                            borderRadius: 'var(--radius-2xl)',
                            padding: '60px 40px',
                            textAlign: 'center',
                            color: 'white',
                        }}>
                            <Video size={64} style={{ marginBottom: '16px', opacity: 0.9 }} />
                            <h3 style={{ color: 'white', marginBottom: '8px' }}>Virtual Therapy</h3>
                            <p style={{ opacity: 0.85, fontSize: '0.9375rem' }}>
                                Connect from anywhere
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-label">Features</span>
                        <h2 className="section-title">Everything You Need for Your Mental Health</h2>
                        <p className="section-description">
                            Our comprehensive platform provides all the tools and support you need
                            to prioritize your mental wellness.
                        </p>
                    </div>

                    <div className="features-grid">
                        {features.map((feature) => (
                            <div key={feature.title} className="feature-card">
                                <div className="feature-icon">
                                    <feature.icon size={28} />
                                </div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-description">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="how-it-works-section">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-label">How It Works</span>
                        <h2 className="section-title">Get Started in 4 Simple Steps</h2>
                        <p className="section-description">
                            We've made it easy to begin your journey to better mental health.
                        </p>
                    </div>

                    <div className="steps-container">
                        {steps.map((step) => (
                            <div key={step.number} className="step-card">
                                <div className="step-number">{step.number}</div>
                                <h3 className="step-title">{step.title}</h3>
                                <p className="step-description">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section id="testimonials" className="testimonials-section">
                <div className="section-container">
                    <div className="section-header">
                        <span className="section-label">Testimonials</span>
                        <h2 className="section-title">What Our Clients Say</h2>
                        <p className="section-description">
                            Real stories from real people who transformed their lives with Treat Health.
                        </p>
                    </div>

                    <div className="testimonials-grid">
                        {testimonials.map((testimonial) => (
                            <div key={testimonial.name} className="testimonial-card">
                                <div className="testimonial-stars">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={18} fill="#fbbf24" />
                                    ))}
                                </div>
                                <p className="testimonial-content">"{testimonial.content}"</p>
                                <div className="testimonial-author">
                                    <div className="testimonial-avatar">{testimonial.initials}</div>
                                    <div className="testimonial-info">
                                        <div className="testimonial-name">{testimonial.name}</div>
                                        <div className="testimonial-role">{testimonial.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-container">
                    <h2 className="cta-title">Ready to Start Your Healing Journey?</h2>
                    <p className="cta-description">
                        Join thousands of people who have already taken the first step towards
                        better mental health. Your journey starts today.
                    </p>
                    <div className="cta-actions">
                        <Link to="/get-started" className="btn btn-primary btn-lg">
                            Get Started Free
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/login" className="btn btn-secondary btn-lg">
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-grid">
                        <div className="footer-brand">
                            <Link to="/" className="navbar-logo" style={{ color: 'white' }}>
                                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                                    <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2" fill="none" />
                                    <path
                                        d="M20 8C20 8 10 14 10 22C10 28.075 14.925 33 21 33C27.075 33 32 28.075 32 22C32 14 20 8 20 8Z"
                                        fill="white"
                                    />
                                    <circle cx="20" cy="20" r="4" fill="#667eea" />
                                </svg>
                                <span style={{ WebkitTextFillColor: 'white' }}>Treat Health</span>
                            </Link>
                            <p>
                                Empowering your journey to mental wellness with compassionate,
                                personalized care from licensed professionals.
                            </p>
                        </div>

                        <div>
                            <h4 className="footer-title">Services</h4>
                            <div className="footer-links">
                                <a href="#">Individual Therapy</a>
                                <a href="#">Group Therapy</a>
                                <a href="#">Family Counseling</a>
                                <a href="#">Couples Therapy</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="footer-title">Company</h4>
                            <div className="footer-links">
                                <a href="#">About Us</a>
                                <a href="#">Our Therapists</a>
                                <a href="#">Careers</a>
                                <a href="#">Contact</a>
                            </div>
                        </div>

                        <div>
                            <h4 className="footer-title">Legal</h4>
                            <div className="footer-links">
                                <a href="#">Privacy Policy</a>
                                <a href="#">Terms of Service</a>
                                <a href="#">HIPAA Notice</a>
                                <a href="#">Accessibility</a>
                            </div>
                        </div>
                    </div>

                    <div className="footer-bottom">
                        <p>© 2024 Treat Health. All rights reserved.</p>
                        <div className="footer-social">
                            <a href="#" aria-label="Twitter"><Twitter size={18} /></a>
                            <a href="#" aria-label="Facebook"><Facebook size={18} /></a>
                            <a href="#" aria-label="Instagram"><Instagram size={18} /></a>
                            <a href="#" aria-label="LinkedIn"><Linkedin size={18} /></a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
