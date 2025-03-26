/**
 * Default highlight color used when no color is provided.
 * @constant {string}
 */
export const DEFAULT_HIGHLIGHT_COLOR = "#ffbf00"; // Yellow

/**
 * Array of colors used for filter highlighting.
 * @constant {string[]}
 */
export const COLORS = [
    "#FFFF99", // Light Yellow
    "#FFD580", // Pale Orange
    "#FFB6C1", // Soft Pink
    "#CCFFCC", // Light Green
    "#ADD8E6", // Sky Blue
    "#FFC0CB", // Pink
    "#FFDAB9", // Peach Puff
    "#FDE74C", // Maize
];

/**
 * Default filter groups available in the application.
 * Each group includes a title, description, and an array of filters.
 * Each filter has properties: regex (boolean), caseSensitive (boolean), text (string),
 * and optionally color (string).
 * @constant {Object[]}
 */
export const DEFAULT_FILTER_GROUPS = [
    {
        title: 'Error Logs',
        description: 'Filters logs containing "ERROR"',
        filters: [{ regex: false, caseSensitive: false, text: 'ERROR', color: "#ff8282" }]
    },
    {
        title: 'User Alice',
        description: 'Filters logs mentioning user Alice',
        filters: [{ regex: false, caseSensitive: false, text: 'Alice', color: "#ffB6C1" }]
    },
    {
        title: 'ip of shape 192.*.1.2',
        description: 'Filters logs containing ip of shape 192.*.1.2',
        filters: [{ regex: true, caseSensitive: false, text: '192\..*\.1\.2' }]
    }
]

/**
 * Maximum number of top results to return in search suggestions.
 * @constant {number}
 */
export const TOP_K = 5;

/**
 * Highlights occurrences of filter texts within the given text.
 *
 * Filters are sorted by descending length to avoid overlapping highlights.
 * If a filter's regex flag is true, its text is used as a regex pattern; otherwise,
 * the text is escaped for a literal match.
 *
 * @param {string} text - The text to process.
 * @param {Object[]} filters - Array of filter objects.
 * @param {string} filters[].text - The filter text.
 * @param {boolean} filters[].regex - Whether to treat the filter text as a regex.
 * @param {boolean} filters[].caseSensitive - Whether matching is case sensitive.
 * @param {string} [filters[].color] - Optional color for highlighting; defaults to DEFAULT_HIGHLIGHT_COLOR.
 * @returns {string} The HTML string with highlighted segments.
 */
export const highlightText = (text, filters) => {
    let highlighted = text;

    // sort filters by length of text to avoid overlapping highlights
    filters.sort((a, b) => b.text.length - a.text.length);

    filters.forEach(({ text: filterText, regex, caseSensitive, color }) => {
        color = color || DEFAULT_HIGHLIGHT_COLOR; // default to yellow if no color is provided
        if (regex) {
            const pattern = new RegExp(filterText, caseSensitive ? '' : 'i');
            highlighted = highlighted.replace(pattern, (match) => {
                return `<span style="background-color: ${color};">${match}</span>`;
            });
        } else {
            // for safety, escape any special regex characters in the filter text
            const escapedFilterText = filterText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(escapedFilterText, caseSensitive ? '' : 'i');
            highlighted = highlighted.replace(pattern, (match) => {
                return `<span style="background-color: ${color};">${match}</span>`;
            });
        }
    });

    return highlighted;
}