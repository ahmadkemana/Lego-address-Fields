import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
    useAttributeValues,
    useShippingAddress,
    useSettings,
    useLanguage,
    useBuyerJourneyIntercept,
    useExtensionCapability,
} from '@shopify/ui-extensions/checkout/preact';

export default function extension() {
    render(<Extension />, document.body);
}

function Extension() {    
    const address = useShippingAddress();
    const settings = useSettings();
    const language = useLanguage();
    
    const [data, setData] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedCityErr, setSelectedCityErr] = useState('');
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedDistrictErr, setSelectedDistrictErr] = useState('');
    const [subdistricts, setSubdistricts] = useState([]);
    const [selectedSubdistrict, setSelectedSubdistrict] = useState('');
    const [selectedSubdistrictErr, setSelectedSubdistrictErr] = useState('');
    const [loading, setLoading] = useState(false);

    const canBlockProgress = useExtensionCapability('block_progress');

    useBuyerJourneyIntercept(({ canBlockProgress }) => {
        if (
            canBlockProgress &&
            selectedCity === '' &&
            cities?.length > 0 &&
            settings?.city_field === 'Yes'
        ) {
            return {
                behavior: 'block',
                reason: 'City is required',
                perform: (result) => {
                    if (result.behavior === 'block') {
                        setSelectedCityErr(
                            getValidationMessage(
                                language,
                                settings,
                                'city',
                                'City is required',
                                'Kota Diperlukan'
                            )
                        );
                    }
                },
            };
        }

        if (
            canBlockProgress &&
            selectedDistrict === '' &&
            districts?.length > 0 &&
            settings?.district_field === 'Yes'
        ) {
            return {
                behavior: 'block',
                reason: 'District is required',
                perform: (result) => {
                    if (result.behavior === 'block') {
                        setSelectedDistrictErr(
                            getValidationMessage(
                                language,
                                settings,
                                'district',
                                'District is required',
                                'Kelurahan Diperlukan'
                            )
                        );
                    }
                },
            };
        }

        if (
            canBlockProgress &&
            selectedSubdistrict === '' &&
            subdistricts?.length > 0 &&
            settings?.subdistrict_field === 'Yes'
        ) {
            return {
                behavior: 'block',
                reason: 'Subdistrict is required',
                perform: (result) => {
                    if (result.behavior === 'block') {
                        setSelectedSubdistrictErr(
                            getValidationMessage(
                                language,
                                settings,
                                'subdistrict',
                                'Subdistrict is required',
                                'Kecamatan Diperlukan'
                            )
                        );
                    }
                },
            };
        }

        return {
            behavior: 'allow',
            perform: () => {
                clearValidationErrors();
            },
        };
    });

    function getValidationMessage(language, settings, field, defaultEn, defaultLocal) {
        const isEnglish = 
            language?.isoCode === 'en' || 
            language?.isoCode === `en-${settings?.country_code}`;
        
        if (isEnglish) {
            return settings?.[`validation_message_${field}_ENG`] ?? defaultEn;
        }
        return settings?.[`validation_message_${field}_translated`] ?? defaultLocal;
    }

    function clearValidationErrors() {
        setSelectedCityErr('');
        setSelectedDistrictErr('');
        setSelectedSubdistrictErr('');
    }

    // Fetch data
    useEffect(() => {
        if (!settings?.addresses_file_url || !address?.countryCode) return;

        setLoading(true);
        const FileUrl = String(settings?.addresses_file_url);
        fetch(FileUrl)
            .then((response) => response.json())
            .then((jsonData) => {
                const filteredData = jsonData?.filter(
                    (item) => item?.country_id === address?.countryCode
                );
                setData(filteredData);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching data:', error);
                setLoading(false);
            });
    }, [settings?.addresses_file_url, address?.countryCode]);

    // Update cities/districts based on province
    useEffect(() => {
        setSelectedCity('');
        setSelectedDistrict('');
        setSelectedSubdistrict('');
        setSubdistricts([]);
        setDistricts([]);

        if (settings?.city_field === 'No') {
            const filteredDistricts = data
                ?.filter(
                    (location) =>
                        location?.region_code === address?.provinceCode
                )
                .map((location) => location?.district);
            setDistricts([...new Set(filteredDistricts)]);
        } else {
            const filteredCities = data?.filter(
                (location) => location?.region_code === address?.provinceCode
            );
            const uniqueCities = [
                ...new Set(filteredCities.map((city) => city?.city)),
            ];
            setCities(uniqueCities);
        }
    }, [data, address?.provinceCode, settings?.city_field]);

    const handleCityChange = async (event) => {
        const value = event.target.value;
        setSelectedCity(value);
        setSelectedCityErr('');
        setSelectedDistrict('');
        setSelectedSubdistrict('');

        const selectedCityDistricts = data
            ?.filter((city) => city?.city === value)
            .map((city) => city?.district);
        setDistricts([...new Set(selectedCityDistricts)]);
    };

    // Update city attribute
    useEffect(() => {
        const updateAttribute = async () => {
            const key = settings?.target_save_note_key_for_city 
                ? String(settings.target_save_note_key_for_city) 
                : 'City';
            const result = await shopify.applyAttributeChange({
                type: 'updateAttribute',
                key: key,
                value: selectedCity,
            });
        };

        if (selectedCity) {
            updateAttribute();
        }
    }, [settings?.target_save_note_key_for_city, selectedCity]);

    const handleDistrictChange = async (event) => {
        const value = event.target.value;
        setSelectedDistrictErr('');
        setSelectedDistrict(value);
        setSelectedSubdistrict('');

        const selectedDistrictSubdistricts = data
            ?.filter((location) => {
                if (settings?.city_field === 'No') {
                    return (
                        location?.region_code === address?.provinceCode &&
                        location?.district === value
                    );
                } else {
                    return (
                        location?.city === selectedCity &&
                        location?.district === value
                    );
                }
            })
            .map((location) => location?.subdistrict);
        setSubdistricts([...new Set(selectedDistrictSubdistricts)]);
    };

    // Update district attribute
    useEffect(() => {
        const updateAttribute = async () => {
           const key = settings?.target_save_note_key_for_district 
                ? String(settings.target_save_note_key_for_district) 
                : 'District';
            const result = await shopify.applyAttributeChange({
                type: 'updateAttribute',
                key: key,
                value: selectedDistrict,
            });
        };

        if (selectedDistrict) {
            updateAttribute();
        }
    }, [settings?.target_save_note_key_for_district, selectedDistrict]);

    const handleSubdistrictChange = async (event) => {
        const value = event.target.value;
        setSelectedSubdistrict(value);
        setSelectedSubdistrictErr('');
    };

    // Update subdistrict attribute
    useEffect(() => {
        const updateAttribute = async () => {
           const key = settings?.target_save_note_key_for_subdistrict 
                ? String(settings.target_save_note_key_for_subdistrict) 
                : 'Subdistrict';
            const result = await shopify.applyAttributeChange({
                type: 'updateAttribute',
                key: key,
                value: selectedSubdistrict,
            });
        };

        if (selectedSubdistrict) {
            updateAttribute();
        }
    }, [settings?.target_save_note_key_for_subdistrict, selectedSubdistrict]);

    const activeFields = [
        settings?.city_field === 'Yes',
        settings?.district_field === 'Yes',
        settings?.subdistrict_field === 'Yes',
    ].filter(Boolean).length;

    const gridColumns = {
        1: ['1fr'],
        2: ['1fr 1fr'],
        3: ['1fr 1fr 1fr'],
    }[activeFields] || ['1fr'];


    

    if (address?.countryCode !== settings?.country_code) {
          return null;
    }

    return (
        <s-grid gridTemplateColumns={gridColumns} gap="base">
            {loading ? (
                <>
                    <s-box border="base" border-width="base" border-radius="base" padding="base">
                        <s-stack gap="small" direction="block">
                            <s-box 
                                background="base" 
                                min-block-size="1.25rem" 
                                border-radius="base"
                            ></s-box>
                            <s-box 
                                background="base" 
                                min-block-size="2.5rem" 
                                border-radius="base"
                            ></s-box>
                        </s-stack>
                    </s-box>
                    <s-box border="base" border-width="base" border-radius="base" padding="base">
                        <s-stack gap="small" direction="block">
                            <s-box 
                                background="base" 
                                min-block-size="1.25rem" 
                                border-radius="base"
                            ></s-box>
                            <s-box 
                                background="base" 
                                min-block-size="2.5rem" 
                                border-radius="base"
                            ></s-box>
                        </s-stack>
                    </s-box>
                    <s-box border="base" border-width="base" border-radius="base" padding="base">
                        <s-stack gap="small" direction="block">
                            <s-box 
                                background="base" 
                                min-block-size="1.25rem" 
                                border-radius="base"
                            ></s-box>
                            <s-box 
                                background="base" 
                                min-block-size="2.5rem" 
                                border-radius="base"
                            ></s-box>
                        </s-stack>
                    </s-box>
                </>
            ) : (
                <>
                    {settings?.city_field === 'Yes' && (
                        <s-select
                            label={getCityLabel(language, settings, selectedCity)}
                            value={selectedCity}
                            onChange={handleCityChange}
                            required={canBlockProgress}
                            error={selectedCityErr || undefined}
                        >
                            {cities?.map((city) => (
                                <s-option key={city} value={city}>
                                    {city}
                                </s-option>
                            ))}
                        </s-select>
                    )}
                    {settings?.district_field === 'Yes' && (
                        <s-select
                            label={getDistrictLabel(language, settings, selectedDistrict)}
                            value={selectedDistrict}
                            onChange={handleDistrictChange}
                            required={canBlockProgress}
                            error={selectedDistrictErr || undefined}
                        >
                            {districts?.map((district) => (
                                <s-option key={district} value={district}>
                                    {district}
                                </s-option>
                            ))}
                        </s-select>
                    )}
                    {settings?.subdistrict_field === 'Yes' && (
                        <s-select
                            label={getSubdistrictLabel(language, settings, selectedSubdistrict)}
                            value={selectedSubdistrict}
                            onChange={handleSubdistrictChange}
                            required={canBlockProgress}
                            error={selectedSubdistrictErr || undefined}
                        >
                            {subdistricts?.map((subdistrict) => (
                                <s-option key={subdistrict} value={subdistrict}>
                                    {subdistrict}
                                </s-option>
                            ))}
                        </s-select>
                    )}
                </>
            )}
        </s-grid>
    );
}

function getCityLabel(language, settings, selectedCity) {
    const isEnglish = 
        language?.isoCode === 'en' || 
        language?.isoCode === `en-${settings?.country_code}`;
    
    if (isEnglish) {
        if (settings?.label_city_ENG) {
            return selectedCity === '' 
                ? `Select ${settings?.label_city_ENG}` 
                : settings?.label_city_ENG;
        }
        return selectedCity === '' ? 'Select City' : 'City';
    }
    
    return settings?.label_city_translated || 'Kota';
}

function getDistrictLabel(language, settings, selectedDistrict) {
    const isEnglish = 
        language?.isoCode === 'en' || 
        language?.isoCode === `en-${settings?.country_code}`;
    
    if (isEnglish) {
        if (settings?.label_district_ENG) {
            return selectedDistrict === '' 
                ? `Select ${settings?.label_district_ENG}` 
                : settings?.label_district_ENG;
        }
        return selectedDistrict === '' ? 'Select District' : 'District';
    }
    
    return settings?.label_district_translated || 'Kelurahan';
}

function getSubdistrictLabel(language, settings, selectedSubdistrict) {
    const isEnglish = 
        language?.isoCode === 'en' || 
        language?.isoCode === `en-${settings?.country_code}`;
    
    if (isEnglish) {
        if (settings?.label_subdistrict_ENG) {
            return selectedSubdistrict === '' 
                ? `Select ${settings?.label_subdistrict_ENG}` 
                : settings?.label_subdistrict_ENG;
        }
        return selectedSubdistrict === '' ? 'Select Subdistrict' : 'Subdistrict';
    }
    
    return settings?.label_subdistrict_translated || 'Kecamatan';
}