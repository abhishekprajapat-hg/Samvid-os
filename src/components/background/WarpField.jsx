import React, { useEffect, useRef } from 'react';

const ArchitecturalGrid = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        let offset = 0;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // 1. The Paper Texture Base
            ctx.fillStyle = '#F8FAFC'; // Match tailwind 'void'
            ctx.fillRect(0, 0, width, height);

            // 2. The Moving Grid Lines
            ctx.beginPath();
            ctx.lineWidth = 1;
            // Subtle gray lines
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';

            const gridSize = 60;

            // Vertical Lines (Moving Slowly)
            for (let x = offset % gridSize; x < width; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }

            // Horizontal Lines (Static)
            for (let y = 0; y < height; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }

            ctx.stroke();

            // Move the vertical lines slowly for a subtle living effect
            offset += 0.2;
            requestAnimationFrame(draw);
        };

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);
        const animId = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animId);
        };
    }, []);

    return (
        <>
            {/* The moving grid canvas */}
            <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
            {/* Subtle Grain overlay for texture */}
            <div className="fixed inset-0 z-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>
        </>
    );
};

export default ArchitecturalGrid;