import { useEffect, useRef, useMemo, memo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
// @ts-ignore - Module may not have types
import 'highcharts/modules/wordcloud';

interface NewsWordCloudProps {
  titles: string[];
  onWordClick?: (word: string) => void;
  selectedWord?: string | null;
}

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
  't', 'can', 'will', 'just', 'don', 'should', 'now', 'says', 'after',
  'over', 'up', 'about', 'into', 'through', 'during', 'before', 'under',
  'between', 'there', 'these', 'those', 'while', 'been', 'being', 'does',
  'did', 'doing', 'would', 'could', 'ought', 'i\'m', 'you\'re', 'he\'s',
  'she\'s', 'it\'s', 'we\'re', 'they\'re', 'i\'ve', 'you\'ve', 'we\'ve',
  'they\'ve', 'i\'d', 'you\'d', 'he\'d', 'she\'d', 'we\'d', 'they\'d',
  'i\'ll', 'you\'ll', 'he\'ll', 'she\'ll', 'we\'ll', 'they\'ll'
]);

function getWordFrequencies(titles: string[]): Array<{ name: string; weight: number }> {
  const wordCounts = new Map<string, number>();

  titles.forEach(title => {
    // Remove special characters and split into words
    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word));

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  // Convert to array and sort by frequency (deterministic order)
  // Sort by weight first, then alphabetically for consistent positioning
  return Array.from(wordCounts.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight; // Higher weight first
      }
      return a.name.localeCompare(b.name); // Alphabetical for same weight
    })
    .slice(0, 50); // Top 50 words
}

function NewsWordCloudInner({ titles, onWordClick, selectedWord }: NewsWordCloudProps) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const onWordClickRef = useRef(onWordClick);
  
  // Update the ref when callback changes (but don't trigger re-render)
  useEffect(() => {
    onWordClickRef.current = onWordClick;
  }, [onWordClick]);

  const wordData = useMemo(() => {
    if (titles.length === 0) return [];
    return getWordFrequencies(titles);
  }, [titles]);
  
  // Update selected word colors without re-rendering the entire chart
  useEffect(() => {
    if (chartRef.current?.chart) {
      const chart = chartRef.current.chart;
      const series = chart.series[0];
      if (series && series.points) {
        series.points.forEach((point: any) => {
          const isSelected = selectedWord === point.name;
          point.update({
            color: isSelected ? '#fbbf24' : undefined,
          }, false); // false = don't redraw yet
        });
        chart.redraw(); // Redraw once after all updates
      }
    }
  }, [selectedWord]);

  const options: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'wordcloud',
      backgroundColor: 'transparent',
      height: 320,
      margin: [10, 10, 10, 10],
    },
    title: {
      text: '',
    },
    credits: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      formatter: function (this: any) {
        return `<b>${this.point.name}</b>: ${this.point.weight} occurrence${this.point.weight > 1 ? 's' : ''}`;
      },
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      style: {
        color: '#e5e7eb',
      },
    },
    series: [{
      type: 'wordcloud',
      data: wordData.map((word, index) => ({
        ...word,
        // Assign colors in a cycling pattern
        color: [
          '#818cf8', '#a78bfa', '#c084fc', '#e879f9',
          '#f472b6', '#fb7185', '#f97316', '#facc15',
          '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa',
        ][index % 12],
      })),
      name: 'Occurrences',
      minFontSize: 14,
      maxFontSize: 80, // Much larger max size for bigger contrast
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 'bold',
      },
      rotation: {
        from: 0,
        to: 0,
        orientations: 1, // All horizontal for better space utilization
      },
      spiral: 'rectangular', // Rectangular spiral spreads better
      cursor: 'pointer',
      point: {
        events: {
          click: function(this: any) {
            if (onWordClickRef.current && this.name) {
              onWordClickRef.current(this.name);
            }
          },
        },
      },
    }],
  }), [wordData]); // Only recreate when wordData changes

  if (wordData.length === 0) {
    return null; // Don't show anything if no data
  }

  return (
    <div className="w-full h-full">
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        ref={chartRef}
        immutable={false} // Allow updates without full re-render
      />
    </div>
  );
}

// Memoize to prevent re-renders when only selectedWord changes
export default memo(NewsWordCloudInner, (prev, next) => {
  // Only re-render if titles change (not if selectedWord or onWordClick changes)
  return prev.titles.length === next.titles.length &&
         prev.titles.every((title, i) => title === next.titles[i]);
});
