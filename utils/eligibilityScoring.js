const calculate_eligibility_score = (startup) => {
    let score = 0;

    if (startup.legally_registered === true) score += 2;
    if (startup.owns_proprietary_product === true) score += 3;

    const highValueBMs = ['SaaS', 'Marketplace', 'AI', 'Mobile App', 'Deep Tech'];
    if (highValueBMs.includes(startup.primary_business_model)) score += 3;

    const highValueRMs = ['Subscription', 'Licensing', 'Transaction Fees'];
    if (highValueRMs.includes(startup.revenue_model)) score += 2;

    const currentYear = new Date().getFullYear();
    if (startup.year_of_incorporation && (currentYear - startup.year_of_incorporation) <= 10) {
        score += 2;
    }

    if (startup.primarily_service_based === true) score -= 3;

    const lowValueRMs = ['Client Contracts', 'Hourly Billing'];
    if (lowValueRMs.includes(startup.revenue_model)) score -= 2;

    if (startup.legally_registered === false && startup.owns_proprietary_product === false) {
        score -= 3;
    }

    return score;
};

const determine_eligibility_status = (score) => {
    if (score >= 6) {
        return "Eligible Startup";
    } else if (score >= 3 && score <= 5) {
        return "Needs Manual Review";
    } else {
        return "Not Eligible";
    }
};

module.exports = { calculate_eligibility_score, determine_eligibility_status };
