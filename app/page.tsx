'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BILLBOARD_BANDS, Band } from '@/lib/bands';
import { scoreRankings, RankedBand } from '@/lib/scoring';
import SortableItem from '@/components/SortableBandList';
import { VotingSession } from '@/lib/types';

type Round = 'round1' | 'round2' | 'round3' | 'round4' | 'results';
type View = 'login' | 'signup' | 'admin-login' | 'voting';

export default function Home() {
  const [view, setView] = useState<View>('login');
  const [sessionName, setSessionName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // true while checking cookie on mount
  const [adminAuthenticating, setAdminAuthenticating] = useState(false);

  const [currentRound, setCurrentRound] = useState<Round>('round1');
  const [isAdmin, setIsAdmin] = useState(false);
  const [round1Bands, setRound1Bands] = useState<Band[]>([...BILLBOARD_BANDS]);
  const [round2MissingBands, setRound2MissingBands] = useState<string[]>([]);
  const [round3MissingBands, setRound3MissingBands] = useState<Band[]>([]);
  const [round3Votes, setRound3Votes] = useState<string[]>([]);
  const [newBandInput, setNewBandInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allBands, setAllBands] = useState<Band[]>([]);
  const [finalRankings, setFinalRankings] = useState<RankedBand[]>([]);
  const [collaborativeRankings, setCollaborativeRankings] = useState<any[]>([]);
  const [loadingCollaborative, setLoadingCollaborative] = useState(false);
  const [finalTop50, setFinalTop50] = useState<Band[]>([]);
  const [outsiderBands, setOutsiderBands] = useState<Band[]>([]);
  const [lastBandOut, setLastBandOut] = useState<Band | null>(null);
  const [draggedBand, setDraggedBand] = useState<any>(null);
  const [activeDropZone, setActiveDropZone] = useState<number | null>(null);
  const [originalCollaborativeRankings, setOriginalCollaborativeRankings] = useState<any[]>([]);
  const [originalBillboardTop50, setOriginalBillboardTop50] = useState<Band[]>([]);
  const [insertedBandsPositions, setInsertedBandsPositions] = useState<Map<string, number>>(new Map());
  const [selectedBand, setSelectedBand] = useState<any>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 150, // 150ms delay for more intentional dragging
        tolerance: 5, // 5px movement tolerance
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Slightly longer delay for touch to prevent accidental drags
        tolerance: 8, // More tolerance for touch
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-save functionality
  const saveSession = async () => {
    if (!sessionName || isAdmin) return; // Skip auto-save for admin users

    setSaving(true);
    try {
      const sessionData: VotingSession = {
        sessionName,
        currentRound,
        isAdmin,
        round1Bands,
        round2MissingBands,
        round3Votes: [], // Will be updated when implementing Round 3
        allBands,
        knockedOutBands: [], // Will be updated when implementing Round 4
        finalRankings,
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: currentRound === 'results',
      };

      const response = await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save whenever data changes
  useEffect(() => {
    if (view === 'voting' && sessionName) {
      const timer = setTimeout(() => {
        saveSession();
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timer);
    }
  }, [currentRound, round1Bands, round2MissingBands, round3Votes, allBands, finalRankings]);

  // Check auth status on mount (user auth + admin auth)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check user auth first
        const authRes = await fetch('/api/auth/status');
        const authData = await authRes.json();

        if (authData.authenticated) {
          setSessionName(authData.user.displayName);

          if (authData.user.isAdmin) {
            setIsAdmin(true);
            setView('voting');
            setCurrentRound('round4');
          } else {
            // Load existing voting session
            const sessionRes = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionName: authData.user.displayName, action: 'load' }),
            });
            const sessionData = await sessionRes.json();
            if (sessionRes.ok && sessionData.session) {
              const session: VotingSession = sessionData.session;
              setCurrentRound(session.currentRound);
              setRound1Bands(session.round1Bands);
              setRound2MissingBands(session.round2MissingBands || []);
              setRound3Votes(session.round3Votes?.map((v: any) => v.bandId) || []);
              setAllBands(session.allBands);
              setFinalRankings(session.finalRankings);
            }
            setView('voting');
          }
          setAuthLoading(false);
          return;
        }

        // Check env-var super admin
        const adminRes = await fetch('/api/admin/status');
        const adminData = await adminRes.json();
        if (adminData.isAdmin) {
          setIsAdmin(true);
          setSessionName('Admin');
          setView('voting');
          setCurrentRound('round4');
        }
      } catch (error) {
        console.log('No session found');
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Load collaborative rankings and initialize dashboard when admin reaches Round 4
  useEffect(() => {
    const loadCollaborativeData = async () => {
      if (isAdmin && currentRound === 'round4') {
        setLoadingCollaborative(true);
        try {
          // Load both missing bands rankings and aggregated top 50
          const [missingBandsResponse, aggregateResponse] = await Promise.all([
            fetch('/api/missing-bands/votes'),
            fetch('/api/sessions/aggregate')
          ]);

          const missingBandsData = await missingBandsResponse.json();
          const aggregateData = await aggregateResponse.json();

          if (missingBandsResponse.ok && missingBandsData.rankings) {
            setCollaborativeRankings(missingBandsData.rankings);
            setOriginalCollaborativeRankings(missingBandsData.rankings); // Store original for reset
          }

          // Initialize dashboard with aggregated top 50 or fallback to Billboard
          if (aggregateResponse.ok && aggregateData.aggregatedResults?.length > 0) {
            initializeDashboardWithAggregateData(aggregateData.aggregatedResults);
          } else {
            // Fallback to Billboard original if no aggregate data
            initializeDashboard();
          }
        } catch (error) {
          console.error('Failed to load collaborative data:', error);
          // Fallback to Billboard original
          initializeDashboard();
        } finally {
          setLoadingCollaborative(false);
        }
      }
    };

    loadCollaborativeData();
  }, [isAdmin, currentRound]);

  // Initialize dashboard with aggregated collaborative top 50
  const initializeDashboardWithAggregateData = (aggregatedResults: any[]) => {
    // Convert aggregated results to Band format
    const collaborativeTop50 = aggregatedResults.slice(0, 50).map((result: any) => ({
      id: result.bandId || `band-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: result.bandName,
      isNewAddition: false // These are the collaborative results, not new additions
    }));

    const outsiders = aggregatedResults.slice(50).map((result: any) => ({
      id: result.bandId || `band-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: result.bandName,
      isNewAddition: false
    }));

    setFinalTop50(collaborativeTop50);
    setOriginalBillboardTop50(collaborativeTop50); // Store for reset
    setOutsiderBands(outsiders);
    setLastBandOut(outsiders.length > 0 ? outsiders[0] : null);
  };

  // Initialize dashboard with Billboard top 50 and split outsiders (fallback)
  const initializeDashboard = () => {
    if (round1Bands.length > 0) {
      const top50 = round1Bands.slice(0, 50);
      const outsiders = round1Bands.slice(50);

      setFinalTop50(top50);
      setOriginalBillboardTop50(top50); // Store original for reset
      setOutsiderBands(outsiders);
      setLastBandOut(outsiders.length > 0 ? outsiders[0] : null);
    }
  };

  // Drag-and-drop event handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // Check if dragging from picklist (collaborative rankings)
    const ranking = collaborativeRankings.find((r: any) => r.bandId === active.id);
    if (ranking) {
      setDraggedBand({ ...ranking, source: 'picklist' });
      return;
    }

    // Check if dragging from final rankings (only inserted bands can be moved)
    const finalBand = finalTop50.find((band: Band) => band.id === active.id);
    if (finalBand && finalBand.isNewAddition) {
      setDraggedBand({ ...finalBand, source: 'finalRankings' });
      return;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !draggedBand) {
      setDraggedBand(null);
      setActiveDropZone(null);
      return;
    }

    if (draggedBand.source === 'picklist') {
      // Handle insertion from picklist
      const dropPosition = parseInt(over.id.toString().replace('drop-zone-', ''));
      if (dropPosition >= 1 && dropPosition <= 50 && isValidDropPosition(dropPosition)) {
        insertBandAtPosition(draggedBand, dropPosition);

        // Track this band's insertion position
        const newPositions = new Map(insertedBandsPositions);
        newPositions.set(draggedBand.bandId, dropPosition);
        setInsertedBandsPositions(newPositions);
      }
    } else if (draggedBand.source === 'finalRankings') {
      // Handle reordering within final rankings
      const oldPosition = finalTop50.findIndex(band => band.id === active.id);
      const newPosition = parseInt(over.id.toString().replace('sortable-', '')) - 1;

      if (oldPosition !== -1 && newPosition >= 0 && newPosition < 50) {
        reorderInFinalRankings(oldPosition, newPosition);
      }
    }

    setDraggedBand(null);
    setActiveDropZone(null);
  };

  // Reorder bands within final rankings
  const reorderInFinalRankings = (oldIndex: number, newIndex: number) => {
    const newFinalTop50 = arrayMove(finalTop50, oldIndex, newIndex);
    setFinalTop50(newFinalTop50);
  };

  const handleDragCancel = () => {
    setDraggedBand(null);
    setActiveDropZone(null);
  };

  // Insert band with push-down logic
  const insertBandAtPosition = (ranking: any, position: number) => {
    const newBand: Band = {
      id: ranking.bandId,
      name: ranking.bandName,
      isNewAddition: true,
    };

    // Create new arrays
    const newTop50 = [...finalTop50];
    const newOutsiders = [...outsiderBands];
    const newCollaborative = collaborativeRankings.filter((r: any) => r.bandId !== ranking.bandId);

    // Insert the band at the specified position (push everything down)
    newTop50.splice(position - 1, 0, newBand);

    // Move the band that got pushed out of position 50 to outsiders
    if (newTop50.length > 50) {
      const pushedOutBand = newTop50[50];
      newTop50.splice(50, 1);
      newOutsiders.unshift(pushedOutBand);
    }

    // Update states
    setFinalTop50(newTop50);
    setOutsiderBands(newOutsiders);
    setLastBandOut(newOutsiders.length > 0 ? newOutsiders[0] : null);
    setCollaborativeRankings(newCollaborative);
  };

  // Reset dashboard to original state
  const resetDashboard = () => {
    if (window.confirm('Are you sure you want to reset the dashboard? This will remove all inserted bands and restore the original picklist.')) {
      setFinalTop50([...originalBillboardTop50]);
      setCollaborativeRankings([...originalCollaborativeRankings]);
      setOutsiderBands([]);
      setLastBandOut(null);
      setInsertedBandsPositions(new Map());
    }
  };

  // Calculate valid drop positions for a band based on its position in the picklist
  const getValidDropPositions = (bandId: string): number[] => {
    const bandIndex = collaborativeRankings.findIndex((r: any) => r.bandId === bandId);
    if (bandIndex === -1) return [];

    // Get minimum position based on previously inserted bands
    let minPosition = 1;

    // Check all bands that came before this one in the picklist
    for (let i = 0; i < bandIndex; i++) {
      const prevBandId = collaborativeRankings[i].bandId;
      const prevPosition = insertedBandsPositions.get(prevBandId);
      if (prevPosition && prevPosition >= minPosition) {
        minPosition = prevPosition + 1;
      }
    }

    // Return valid positions (from minimum to 50)
    const validPositions = [];
    for (let pos = minPosition; pos <= 50; pos++) {
      validPositions.push(pos);
    }
    return validPositions;
  };

  // Check if a position is valid for the currently dragged band
  const isValidDropPosition = (position: number): boolean => {
    if (!draggedBand || draggedBand.source !== 'picklist') return true;
    const validPositions = getValidDropPositions(draggedBand.bandId);
    return validPositions.includes(position);
  };

  // Check if a position is valid for the currently selected band
  const isValidSelectPosition = (position: number): boolean => {
    if (!selectedBand) return false;
    const validPositions = getValidDropPositions(selectedBand.bandId);
    return validPositions.includes(position);
  };

  // Click-to-select functions
  const selectBand = (ranking: any) => {
    if (selectedBand?.bandId === ranking.bandId) {
      // Clicking the same band deselects it
      setSelectedBand(null);
    } else {
      // Select the band
      setSelectedBand(ranking);
    }
  };

  const insertSelectedBandAtPosition = (position: number) => {
    if (!selectedBand || !isValidSelectPosition(position)) return;

    // Insert the selected band using existing logic
    insertBandAtPosition(selectedBand, position);

    // Track this band's insertion position
    const newPositions = new Map(insertedBandsPositions);
    newPositions.set(selectedBand.bandId, position);
    setInsertedBandsPositions(newPositions);

    // Clear selection after insertion
    setSelectedBand(null);
  };

  const adminLogin = async () => {
    setError('');
    setAdminAuthenticating(true);

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setError('Please enter both username and password');
      setAdminAuthenticating(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsAdmin(true);
        setSessionName('Admin');
        setView('voting');
        setCurrentRound('round4'); // Admin goes directly to Round 4 dashboard
        setAdminUsername('');
        setAdminPassword('');
      } else {
        setError(data.error || 'Invalid admin credentials');
      }
    } catch (error) {
      setError('Failed to authenticate admin');
    } finally {
      setAdminAuthenticating(false);
    }
  };

  const adminLogout = async () => {
    try {
      await fetch('/api/admin/status', { method: 'DELETE' });
      setIsAdmin(false);
      setView('login');
      setSessionName('');
      setCurrentRound('round1');
      // Reset all other state as well
      logout();
    } catch (error) {
      console.error('Failed to logout admin:', error);
    }
  };


  const handleSignup = async () => {
    setError('');

    if (!emailInput.trim() || !passwordInput || !displayNameInput.trim() || !secretCodeInput.trim()) {
      setError('All fields are required');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
          displayName: displayNameInput.trim(),
          secretCode: secretCodeInput.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        return;
      }

      setSessionName(data.user.displayName);
      setIsAdmin(data.user.isAdmin);
      setView('voting');
      // Clear form
      setEmailInput('');
      setPasswordInput('');
      setDisplayNameInput('');
      setSecretCodeInput('');
    } catch (error) {
      setError('Failed to create account');
    }
  };

  const handleLogin = async () => {
    setError('');

    if (!emailInput.trim() || !passwordInput) {
      setError('Email and password are required');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      setSessionName(data.user.displayName);
      setIsAdmin(data.user.isAdmin);

      if (data.user.isAdmin) {
        setView('voting');
        setCurrentRound('round4');
      } else {
        // Load voting session
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionName: data.user.displayName, action: 'load' }),
        });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.session) {
          const session: VotingSession = sessionData.session;
          setCurrentRound(session.currentRound);
          setRound1Bands(session.round1Bands);
          setRound2MissingBands(session.round2MissingBands || []);
          setRound3Votes(session.round3Votes?.map((v: any) => v.bandId) || []);
          setAllBands(session.allBands);
          setFinalRankings(session.finalRankings);
        }
        setView('voting');
      }

      // Clear form
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      setError('Login failed');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/status', { method: 'DELETE' });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setView('login');
    setSessionName('');
    setEmailInput('');
    setPasswordInput('');
    setCurrentRound('round1');
    setIsAdmin(false);
    setRound1Bands([...BILLBOARD_BANDS]);
    setRound2MissingBands([]);
    setRound3MissingBands([]);
    setRound3Votes([]);
    setAllBands([]);
    setFinalRankings([]);
  };

  // Round 1: Rerank Billboard's 50
  const handleRound1DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRound1Bands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const goBack = () => {
    if (currentRound === 'round2') setCurrentRound('round1');
    else if (currentRound === 'round3') setCurrentRound('round2');
    else if (currentRound === 'round4') setCurrentRound('round3');
    else if (currentRound === 'results') setCurrentRound('round4');
  };

  const finishRound1 = () => {
    setCurrentRound('round2');
  };

  // Round 2: Add and rank missing bands
  const searchArtists = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/search/artists?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (response.ok && data.artists) {
        setSearchResults(data.artists);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (newBandInput.trim().length > 0) {
      const timer = setTimeout(() => {
        searchArtists(newBandInput);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [newBandInput]);

  const isDuplicate = (bandName: string): boolean => {
    const normalizedName = bandName.toLowerCase().trim();

    // Check against already added missing bands
    const alreadyAdded = round2MissingBands.some(
      (name) => name.toLowerCase().trim() === normalizedName
    );

    // Check against Billboard bands
    const inBillboard = BILLBOARD_BANDS.some(
      (band) => band.name.toLowerCase().trim() === normalizedName
    );

    return alreadyAdded || inBillboard;
  };

  const addBandFromSearch = async (artist: any) => {
    if (isDuplicate(artist.name)) {
      alert(`"${artist.name}" is already in the list!`);
      return;
    }

    try {
      // Add to global missing bands collection
      const response = await fetch('/api/missing-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artist.name, sessionName }),
      });

      const data = await response.json();

      if (response.ok && data.band) {
        // Just add the band name to the user's missing bands list
        setRound2MissingBands([...round2MissingBands, artist.name]);
        setNewBandInput('');
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to add band:', error);
      alert('Failed to add band. Please try again.');
    }
  };

  const addNewBand = async () => {
    const bandName = newBandInput.trim();
    if (!bandName) return;

    if (isDuplicate(bandName)) {
      alert(`"${bandName}" is already in the list!`);
      return;
    }

    try {
      // Add to global missing bands collection
      const response = await fetch('/api/missing-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bandName, sessionName }),
      });

      const data = await response.json();

      if (response.ok && data.band) {
        // Just add the band name to the user's missing bands list
        setRound2MissingBands([...round2MissingBands, bandName]);
        setNewBandInput('');
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to add band:', error);
      alert('Failed to add band. Please try again.');
    }
  };

  // Round 2 no longer needs drag-and-drop - just collecting band names

  const finishRound2 = async () => {
    // Fetch all missing bands for Round 3 voting
    try {
      const response = await fetch('/api/missing-bands');
      const data = await response.json();

      if (response.ok && data.missingBands) {
        const bands: Band[] = data.missingBands.map((band: any) => ({
          id: band.id,
          name: band.name,
          isNewAddition: true,
        }));
        setRound3MissingBands(bands);
      }
      setCurrentRound('round3');
    } catch (error) {
      console.error('Failed to fetch missing bands:', error);
      // Continue to round 3 anyway with empty list
      setCurrentRound('round3');
    }
  };

  // Round 3: Collaborative voting for missing bands
  const handleRound3DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRound3MissingBands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const finishRound3 = async () => {
    // Submit user's votes for missing bands
    try {
      const votes = round3MissingBands.map(band => ({ bandId: band.id }));

      const response = await fetch('/api/missing-bands/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName, votes }),
      });

      if (response.ok) {
        // Set votes for display/tracking
        setRound3Votes(round3MissingBands.map(b => b.id));

        if (isAdmin) {
          // Admin goes to Round 4 (insertion round)
          setCurrentRound('round4');
        } else {
          // Non-admin goes to results (they can view but not edit)
          setCurrentRound('results');
        }
      } else {
        alert('Failed to submit votes. Please try again.');
      }
    } catch (error) {
      console.error('Failed to submit votes:', error);
      alert('Failed to submit votes. Please try again.');
    }
  };

  // Round 4: Final ranking of all bands
  const handleRound4DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAllBands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const finishRound4 = async () => {
    // Create complete ranked list from final dashboard state
    const completeRankedList = [
      ...finalTop50.map((band, index) => ({
        id: band.id,
        name: band.name,
        position: index + 1,
        score: 1000 - index, // High scores for top 50
        isNewAddition: band.isNewAddition || false
      })),
      ...outsiderBands.map((band, index) => ({
        id: band.id,
        name: band.name,
        position: 51 + index,
        score: 950 - index, // Lower scores for outsiders
        isNewAddition: band.isNewAddition || false
      }))
    ];

    setFinalRankings(completeRankedList as RankedBand[]);
    setCurrentRound('results');
  };

  const round1Scored = useMemo(() => {
    if (currentRound === 'round1') {
      const bandNameMap = new Map(round1Bands.map(b => [b.id, b.name]));
      return scoreRankings(round1Bands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [round1Bands, currentRound]);

  // Round 2 no longer has scoring - just collecting band names

  const round3Scored = useMemo(() => {
    if (currentRound === 'round3' && round3MissingBands.length > 0) {
      const bandNameMap = new Map(round3MissingBands.map(b => [b.id, b.name]));
      return scoreRankings(round3MissingBands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [round3MissingBands, currentRound]);

  const round4Scored = useMemo(() => {
    if (currentRound === 'round4') {
      const bandNameMap = new Map(allBands.map(b => [b.id, b.name]));
      return scoreRankings(allBands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [allBands, currentRound]);

  // Loading state while checking auth cookie on mount
  if (authLoading) {
    return (
      <div className="min-h-screen bg-spotify-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-spotify-green rounded-full border-t-transparent mx-auto mb-4"></div>
          <p className="text-spotify-light-gray text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Login View
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8 border border-spotify-gray">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-block p-3 sm:p-4 bg-spotify-green rounded-full mb-3 sm:mb-4">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
                </svg>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">
                Rock Band Ranker
              </h1>
              <p className="text-spotify-light-gray text-xs sm:text-base">
                Log in to start ranking
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="you@email.com"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02] text-sm sm:text-base"
            >
              Log In
            </button>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-spotify-light-gray text-sm">
                Don't have an account?{' '}
                <button
                  onClick={() => { setView('signup'); setError(''); }}
                  className="text-spotify-green hover:text-spotify-green-dark font-medium underline"
                >
                  Sign Up
                </button>
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-spotify-gray">
              <button
                onClick={() => { setView('admin-login'); setError(''); }}
                className="w-full text-center text-sm text-spotify-light-gray hover:text-white transition-colors"
              >
                Admin Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sign Up View
  if (view === 'signup') {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8 border border-spotify-gray">
            <div className="text-center mb-5 sm:mb-8">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">
                Create Account
              </h1>
              <p className="text-spotify-light-gray text-xs sm:text-base">
                Join the ranking
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your public name (e.g. Mike)"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-1.5">
                  Secret Code
                </label>
                <input
                  type="text"
                  value={secretCodeInput}
                  onChange={(e) => setSecretCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                  placeholder="Get this from the organizer"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSignup}
              className="w-full bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02] text-sm sm:text-base"
            >
              Create Account
            </button>

            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-spotify-light-gray text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => { setView('login'); setError(''); }}
                  className="text-spotify-green hover:text-spotify-green-dark font-medium underline"
                >
                  Log In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin Login View
  if (view === 'admin-login') {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-6 sm:p-8 border border-spotify-gray">
            {/* Logo/Title */}
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-red-600 rounded-full mb-4">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M12 7C13.4 7 14.8 8.6 14.8 10V11.5C15.4 11.5 16 12.4 16 13V16C16 17.4 15.4 18 14.8 18H9.2C8.6 18 8 17.4 8 16V13C8 12.4 8.6 11.5 9.2 11.5V10C9.2 8.6 10.6 7 12 7M12 8.2C11.2 8.2 10.5 8.7 10.5 10V11.5H13.5V10C13.5 8.7 12.8 8.2 12 8.2Z"/>
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Admin Login
              </h1>
              <p className="text-spotify-light-gray text-sm sm:text-base">
                Restricted access for administrators
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !adminAuthenticating && adminLogin()}
                  placeholder="Enter admin username"
                  className="w-full px-4 py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white placeholder-spotify-light-gray focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  disabled={adminAuthenticating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-spotify-light-gray mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !adminAuthenticating && adminLogin()}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white placeholder-spotify-light-gray focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  disabled={adminAuthenticating}
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={adminLogin}
                disabled={adminAuthenticating}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-spotify-gray disabled:opacity-50 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 disabled:transform-none"
              >
                {adminAuthenticating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    Authenticating...
                  </span>
                ) : (
                  'Login as Admin'
                )}
              </button>
              <button
                onClick={() => {
                  setView('login');
                  setError('');
                  setAdminUsername('');
                  setAdminPassword('');
                }}
                className="w-full bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
              >
                ← Back to User Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Drag-and-Drop Components
  function DraggablePicklistItem({ ranking, isDragging }: { ranking: any, isDragging: boolean }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging: isDragState,
    } = useDraggable({
      id: ranking.bandId,
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 1000, // Ensure dragged item appears above everything
    } : undefined;

    const isSelected = selectedBand?.bandId === ranking.bandId;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex items-center justify-between rounded-lg p-2.5 sm:p-4 transition-all min-h-[48px] sm:min-h-[60px] cursor-pointer ${
          isDragState || isDragging
            ? 'bg-spotify-green/40 border-2 border-spotify-green shadow-2xl scale-105 opacity-90'
            : isSelected
            ? 'bg-blue-600/30 border-2 border-blue-500 shadow-lg'
            : 'bg-spotify-gray border-2 border-spotify-gray hover:border-spotify-green hover:bg-spotify-gray/80'
        }`}
        onClick={() => selectBand(ranking)}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <span className="text-base sm:text-lg font-bold text-spotify-green w-7 sm:w-8 text-right flex-shrink-0">
            {ranking.finalPosition}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {ranking.bandName}
          </span>
        </div>

        <div className="text-xs text-spotify-light-gray flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
          <span className="font-medium hidden sm:inline">{ranking.totalScore} pts</span>
          <span className="opacity-75 hidden sm:inline">{ranking.voteCount} votes</span>
          {isSelected && !isDragState && !isDragging && (
            <span className="text-blue-400 font-bold text-xs">
              Tap position →
            </span>
          )}
        </div>

        {isSelected && !isDragState && !isDragging && (
          <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
            ✓
          </div>
        )}
      </div>
    );
  }

  function DroppableRankingsList({ finalTop50, isOver, activeDropZone }: {
    finalTop50: Band[],
    isOver: boolean,
    activeDropZone: number | null
  }) {
    return (
      <SortableContext
        items={finalTop50.map(band => band.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1 max-h-[50vh] sm:max-h-[700px] overflow-y-auto overscroll-contain pr-1 sm:pr-2 border border-white/20 rounded-lg p-2 sm:p-4 bg-gray-900/20">
          {finalTop50.map((band, index) => {
            const position = index + 1;

            if (band.isNewAddition) {
              // Sortable item for inserted bands
              return (
                <SortableRankingItem
                  key={band.id}
                  band={band}
                  position={position}
                  isOver={activeDropZone === position}
                />
              );
            } else {
              // Drop-only item for Billboard bands
              return (
                <DroppableRankingItem
                  key={band.id}
                  band={band}
                  position={position}
                  isOver={activeDropZone === position}
                />
              );
            }
          })}

          {/* Add drop zone after position 50 if needed */}
          {finalTop50.length < 50 && (
            <DroppableRankingItem
              key="empty-slot"
              band={null}
              position={finalTop50.length + 1}
              isOver={activeDropZone === finalTop50.length + 1}
            />
          )}
        </div>
      </SortableContext>
    );
  }

  function SortableRankingItem({ band, position, isOver }: {
    band: Band,
    position: number,
    isOver: boolean
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: band.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1000 : 'auto',
    };

    const { setNodeRef: setDropRef } = useDroppable({
      id: `drop-zone-${position}`,
    });

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          setDropRef(node);
        }}
        style={style}
        className={`relative flex items-center justify-between rounded-lg p-2 sm:p-3 transition-all min-h-[40px] sm:min-h-[48px] cursor-move ${
          isDragging
            ? 'bg-spotify-green/40 border-2 border-spotify-green shadow-2xl scale-105 opacity-90'
            : isOver
            ? 'bg-spotify-green/30 border-2 border-spotify-green shadow-xl ring-2 ring-spotify-green/50'
            : 'bg-spotify-green/10 border-2 border-spotify-green/50'
        }`}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className="text-xs sm:text-sm font-bold w-6 sm:w-8 text-right flex-shrink-0 text-spotify-green">
            {position}
          </span>
          <span className="text-xs sm:text-sm font-medium text-white truncate">
            {band.name}
          </span>
          <span className="text-[10px] sm:text-xs bg-spotify-green text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
            NEW
          </span>
        </div>
      </div>
    );
  }

  function DroppableRankingItem({ band, position, isOver }: {
    band: Band | null,
    position: number,
    isOver: boolean
  }) {
    const { setNodeRef } = useDroppable({
      id: `drop-zone-${position}`,
    });

    const isValidDrop = isValidDropPosition(position);
    const isValidSelect = isValidSelectPosition(position);
    const isDraggingFromPicklist = draggedBand?.source === 'picklist';
    const hasSelectedBand = !!selectedBand;

    return (
      <div
        ref={setNodeRef}
        onClick={() => hasSelectedBand && isValidSelect ? insertSelectedBandAtPosition(position) : undefined}
        className={`relative flex items-center justify-between rounded-lg p-2 sm:p-3 transition-all min-h-[40px] sm:min-h-[48px] ${
          hasSelectedBand && isValidSelect ? 'cursor-pointer' : ''
        } ${
          isOver && isValidDrop
            ? 'bg-spotify-green/30 border-2 border-spotify-green shadow-xl ring-2 ring-spotify-green/50'
            : isOver && !isValidDrop
            ? 'bg-red-900/30 border-2 border-red-600 shadow-xl ring-2 ring-red-600/50'
            : hasSelectedBand && isValidSelect
            ? 'bg-blue-600/20 border-2 border-blue-500 hover:bg-blue-600/30'
            : hasSelectedBand && !isValidSelect
            ? 'bg-red-900/10 border-2 border-red-600/30 opacity-50'
            : isDraggingFromPicklist && !isValidDrop
            ? 'bg-red-900/10 border-2 border-red-600/30 opacity-50'
            : isDraggingFromPicklist && isValidDrop
            ? 'bg-spotify-green/10 border-2 border-spotify-green/50'
            : band
            ? 'bg-spotify-gray/50 border-2 border-spotify-gray'
            : 'bg-dashed border-2 border-dashed border-spotify-light-gray/30'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className={`text-xs sm:text-sm font-bold w-6 sm:w-8 text-right flex-shrink-0 ${
            isOver && isValidDrop ? 'text-spotify-green'
            : isOver && !isValidDrop ? 'text-red-400'
            : hasSelectedBand && isValidSelect ? 'text-blue-400'
            : band ? 'text-spotify-light-gray'
            : 'text-spotify-light-gray/50'
          }`}>
            {position}
          </span>
          <span className="text-xs sm:text-sm font-medium text-white truncate">
            {isOver && draggedBand ? (
              <span className={`font-bold ${isValidDrop ? 'text-spotify-green' : 'text-red-400'}`}>
                → {draggedBand.bandName || draggedBand.name}
              </span>
            ) : hasSelectedBand && isValidSelect ? (
              <span className="text-blue-400 font-medium">
                {band ? band.name : 'Empty'} — tap to insert here
              </span>
            ) : band ? (
              band.name
            ) : (
              <span className="text-spotify-light-gray/70 italic">Empty</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  // Voting View
  return (
    <div className="min-h-screen bg-spotify-black p-2 sm:p-6 lg:p-8 pb-16 sm:pb-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4 sm:mb-8">
          <div className="flex justify-between items-center gap-2 mb-2 sm:mb-4">
            <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white truncate">
              Rock Band Ranker
            </h1>
            <button
              onClick={isAdmin ? adminLogout : logout}
              className="text-xs sm:text-sm bg-spotify-gray hover:bg-spotify-gray/80 text-spotify-light-gray hover:text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all border border-spotify-light-gray/20 flex-shrink-0"
            >
              {isAdmin ? 'Admin Logout' : 'Logout'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm sm:text-lg text-spotify-light-gray">
              Session: <span className="font-bold text-spotify-green">{sessionName}</span>
            </p>
            {saving && (
              <p className="text-xs sm:text-sm text-spotify-green flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-spotify-green rounded-full animate-pulse"></span>
                Saving...
              </p>
            )}
          </div>
        </header>

        {/* Round 1: Rerank Billboard's 50 */}
        {currentRound === 'round1' && !isAdmin && (
          <div>
            <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-spotify-gray">
              <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                Round 1: Rerank Billboard's Top 50
              </h2>
              <p className="text-spotify-light-gray mb-3 sm:mb-6 text-xs sm:text-base">
                Drag the handle to reorder bands. Top 10 positions are worth significantly more points.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRound1DragEnd}
              >
                <SortableContext
                  items={round1Bands.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1 sm:space-y-2 max-h-[60vh] sm:max-h-[600px] overflow-y-auto overscroll-contain pr-1 sm:pr-2">
                    {round1Scored.map((band) => (
                      <SortableItem
                        key={band.id}
                        id={band.id}
                        name={band.name}
                        position={band.position}
                        score={band.score}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                onClick={finishRound1}
                className="mt-4 sm:mt-6 w-full bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02]"
              >
                Continue to Round 2 →
              </button>
            </div>
          </div>
        )}

        {/* Round 2: Add Missing Bands */}
        {currentRound === 'round2' && !isAdmin && (
          <div>
            <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-spotify-gray">
              <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                Round 2: Add Missing Bands
              </h2>
              <p className="text-spotify-light-gray mb-3 sm:mb-6 text-xs sm:text-base">
                Add bands you think are missing from the Billboard top 50. We'll vote on their rankings in Round 3.
              </p>

              {/* Sticky Search Box */}
              <div className="mb-4 sm:mb-6 sticky top-0 bg-spotify-dark-gray z-10 pb-3 sm:pb-4 -mt-3 sm:-mt-4 pt-3 sm:pt-4">
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newBandInput}
                        onChange={(e) => setNewBandInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !showSuggestions) {
                            addNewBand();
                          }
                        }}
                        placeholder="Search for a band..."
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white text-sm sm:text-base placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                      />
                      {searching && (
                        <div className="absolute right-3 top-2.5 sm:top-3">
                          <div className="animate-spin h-5 w-5 border-2 border-spotify-green rounded-full border-t-transparent"></div>
                        </div>
                      )}

                      {/* Search Suggestions Dropdown */}
                      {showSuggestions && searchResults.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-spotify-gray border border-spotify-green rounded-lg shadow-2xl max-h-60 sm:max-h-80 overflow-y-auto z-20">
                          {searchResults.map((artist) => {
                            const duplicate = isDuplicate(artist.name);
                            return (
                              <button
                                key={artist.id}
                                onClick={() => !duplicate && addBandFromSearch(artist)}
                                disabled={duplicate}
                                className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-spotify-green/20 border-b border-spotify-dark-gray last:border-b-0 transition-colors ${
                                  duplicate ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                <div className="font-medium text-white text-sm sm:text-base">
                                  {artist.name}
                                  {duplicate && (
                                    <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full border border-red-700">
                                      Added
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs sm:text-sm text-spotify-light-gray">
                                  {artist.type && `${artist.type}`}
                                  {artist.country && ` • ${artist.country}`}
                                  {artist.disambiguation && ` • ${artist.disambiguation}`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={addNewBand}
                      className="bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-full transition-all transform hover:scale-105 whitespace-nowrap text-sm sm:text-base"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-spotify-light-gray mt-1.5 sm:mt-2 hidden sm:block">
                    Type to search MusicBrainz database or click "Add" to add any band name
                  </p>
                </div>
              </div>

              {round2MissingBands.length > 0 && (
                <>
                  <h3 className="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4">
                    Your Submitted Bands ({round2MissingBands.length})
                  </h3>
                  <div className="space-y-1 sm:space-y-2 max-h-[40vh] sm:max-h-[400px] overflow-y-auto overscroll-contain pr-1 sm:pr-2">
                    {round2MissingBands.map((bandName, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-spotify-gray border-2 border-spotify-gray rounded-lg p-2.5 sm:p-4"
                      >
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <span className="text-base sm:text-2xl font-bold text-spotify-green w-7 sm:w-12 text-right flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-sm sm:text-lg font-medium text-white truncate">
                            {bandName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 sm:mt-6 flex gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all border border-spotify-light-gray/30 text-sm sm:text-base"
                >
                  ← Back
                </button>
                <button
                  onClick={finishRound2}
                  className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all transform hover:scale-[1.02] text-sm sm:text-base"
                >
                  Round 3 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Round 3: Rank All User-Added Bands */}
        {currentRound === 'round3' && !isAdmin && (
          <div>
            <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-spotify-gray">
              <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                Round 3: Vote on Missing Bands
              </h2>
              <p className="text-spotify-light-gray mb-3 sm:mb-6 text-xs sm:text-base">
                {round3MissingBands.length} bands submitted by everyone. Drag the handle to rank them. Your votes combine with others.
              </p>

              {round3MissingBands.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-spotify-light-gray">
                  <p className="mb-4 text-sm sm:text-base">No bands have been added by any users yet.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={goBack}
                      className="bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all border border-spotify-light-gray/30 text-sm sm:text-base"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={finishRound3}
                      className="bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all transform hover:scale-[1.02] text-sm sm:text-base"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleRound3DragEnd}
                  >
                    <SortableContext
                      items={round3MissingBands.map(b => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1 sm:space-y-2 max-h-[60vh] sm:max-h-[600px] overflow-y-auto overscroll-contain pr-1 sm:pr-2">
                        {round3Scored.map((band) => (
                          <SortableItem
                            key={band.id}
                            id={band.id}
                            name={band.name}
                            position={band.position}
                            score={band.score}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="mt-4 sm:mt-6 flex gap-3">
                    <button
                      onClick={goBack}
                      className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all border border-spotify-light-gray/30 text-sm sm:text-base"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={finishRound3}
                      className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-4 sm:px-6 rounded-full transition-all transform hover:scale-[1.02] text-sm sm:text-base"
                    >
                      Submit Votes →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Round 4: Admin Dashboard */}
        {currentRound === 'round4' && (
          <div>
            {isAdmin ? (
              <DndContext
                sensors={sensors}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
              >
                <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-spotify-gray">
                  <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                    Final Rankings Dashboard
                  </h2>
                  <p className="text-spotify-light-gray mb-3 sm:mb-6 text-xs sm:text-base">
                    Select a band from the picklist, then tap a position to insert it. Inserted bands push others down.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
                    {/* Left Column: Picklist (40% width) */}
                    <div className="lg:col-span-5">
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h3 className="text-base sm:text-xl font-bold text-spotify-green">Picklist</h3>
                        <button
                          onClick={resetDashboard}
                          className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-all transform hover:scale-105 border border-red-500"
                          title="Reset dashboard to original state"
                        >
                          🔄 RESET
                        </button>
                      </div>
                      <p className="text-xs text-spotify-light-gray mb-3">
                        Inserted: {originalCollaborativeRankings.length - collaborativeRankings.length} / {originalCollaborativeRankings.length} bands
                      </p>
                      <div className="space-y-1 sm:space-y-2 max-h-[40vh] sm:max-h-[700px] overflow-y-auto overscroll-contain pr-1 sm:pr-2 border border-spotify-green rounded-lg p-2 sm:p-4 bg-spotify-green/5">
                        {loadingCollaborative ? (
                          <div className="text-center text-spotify-light-gray py-8">
                            <div className="animate-spin h-8 w-8 border-2 border-spotify-green rounded-full border-t-transparent mx-auto mb-4"></div>
                            Loading...
                          </div>
                        ) : collaborativeRankings.length === 0 ? (
                          <div className="text-center text-spotify-light-gray py-8">
                            <p className="mb-2">No bands to insert.</p>
                            <p className="text-xs">All collaborative votes have been processed.</p>
                          </div>
                        ) : (
                          collaborativeRankings.map((ranking) => (
                            <DraggablePicklistItem
                              key={ranking.bandId}
                              ranking={ranking}
                              isDragging={draggedBand?.bandId === ranking.bandId}
                            />
                          ))
                        )}
                      </div>

                      {/* Integrated Stats Section */}
                      <div className="mt-6 space-y-4">
                        {/* Insert Stats */}
                        <div className="bg-spotify-gray/30 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-spotify-light-gray mb-2">📊 Insert Stats</h4>
                          <div className="space-y-1 text-xs text-spotify-light-gray">
                            <div>Total Inserted: {finalTop50.filter(b => b.isNewAddition).length}</div>
                            <div>Remaining Picklist: {collaborativeRankings.length}</div>
                            <div>Outsiders: {outsiderBands.length}</div>
                          </div>
                        </div>

                        {/* Last Band Out */}
                        {lastBandOut && (
                          <div>
                            <h3 className="text-lg font-bold text-yellow-400 mb-3">⚡ Last Band Out</h3>
                            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3">
                              <div className="text-center">
                                <div className="text-xl font-bold text-yellow-400 mb-1">#51</div>
                                <div className="text-white font-medium">{lastBandOut.name}</div>
                                <div className="text-xs text-yellow-300 mt-1">Just missed the cut!</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Outsiders */}
                        {outsiderBands.length > 0 && (
                          <div>
                            <h3 className="text-lg font-bold text-red-400 mb-3">
                              🚫 Outsiders ({outsiderBands.length})
                            </h3>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 border border-red-600 rounded-lg p-3 bg-red-900/10">
                              {outsiderBands.slice(0, 10).map((band, index) => (
                                <div
                                  key={band.id}
                                  className="flex items-center justify-between bg-red-900/20 border border-red-700 rounded-lg p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-400 font-bold text-sm">#{52 + index}</span>
                                    <span className="text-white text-sm truncate">{band.name}</span>
                                  </div>
                                </div>
                              ))}
                              {outsiderBands.length > 10 && (
                                <div className="text-center text-red-400/70 text-xs py-2">
                                  +{outsiderBands.length - 10} more bands...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Final Top 50 (60% width) */}
                    <div className="lg:col-span-7">
                      <h3 className="text-xl font-bold text-white mb-4">🎖️ Final Top 50</h3>
                      <DroppableRankingsList
                        finalTop50={finalTop50}
                        isOver={!!activeDropZone}
                        activeDropZone={activeDropZone}
                      />
                    </div>

                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={finishRound4}
                      className="bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-4 px-8 rounded-full transition-all transform hover:scale-[1.02] shadow-lg"
                    >
                      Calculate Final Results →
                    </button>
                  </div>
                </div>
              </DndContext>
            ) : (
              <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔒</div>
                  <h3 className="text-xl font-bold text-white mb-2">Admin Access Required</h3>
                  <p className="text-spotify-light-gray mb-6">
                    Round 4 is reserved for admin users to create the final collaborative ranking.
                  </p>
                  <p className="text-spotify-light-gray text-sm">
                    Your votes have been submitted! Check back later to see the final results.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {currentRound === 'results' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6 border border-spotify-gray">
              <h2 className="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                Your Final Rankings
              </h2>
              <p className="text-spotify-light-gray mb-3 sm:mb-6 text-xs sm:text-base">
                Your rankings have been saved! Visit the admin page to see aggregated results from all voters.
              </p>

              <div className="space-y-1 sm:space-y-2 max-h-[60vh] sm:max-h-[600px] overflow-y-auto overscroll-contain pr-1 sm:pr-2">
                {finalRankings.map((band, index) => {
                  const originalBand = allBands.find(b => b.id === band.id);
                  const isTopTen = index < 10;
                  return (
                    <div
                      key={band.id}
                      className={`flex items-center justify-between border rounded-lg p-3 sm:p-4 ${
                        originalBand?.isNewAddition
                          ? 'bg-spotify-green/10 border-spotify-green/30'
                          : isTopTen
                          ? 'bg-spotify-gray border-spotify-green/50'
                          : 'bg-spotify-black border-spotify-gray'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <span className={`text-xl sm:text-2xl font-bold w-8 sm:w-12 text-right flex-shrink-0 ${
                          isTopTen ? 'text-spotify-green' : 'text-white'
                        }`}>
                          {band.position}
                        </span>
                        <span className="text-sm sm:text-lg font-medium text-white truncate">
                          {band.name}
                          {originalBand?.isNewAddition && (
                            <span className="ml-2 text-xs bg-spotify-green text-white px-2 py-1 rounded-full">
                              NEW
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-spotify-light-gray font-mono font-bold flex-shrink-0 ml-2">
                        {band.score} pts
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={goBack}
                  className="bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  ← Back to Round 4
                </button>
                <button
                  onClick={isAdmin ? adminLogout : logout}
                  className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  {isAdmin ? 'New Admin Session' : 'Start New Session'}
                </button>
                <a
                  href="/admin"
                  className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02] text-center"
                >
                  View Aggregated Results
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Progress Indicator - Hidden for Admin Users */}
        {!isAdmin && (
          <div className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto flex justify-center gap-2 py-3 sm:py-0 sm:mt-8 bg-spotify-black/90 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none border-t border-spotify-gray/30 sm:border-0 z-30">
            {(['round1', 'round2', 'round3', 'round4', 'results'] as const).map((round, i) => (
              <div key={round} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${currentRound === round ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
                {i < 4 && <div className={`w-3 sm:w-4 h-0.5 ${currentRound === round || ((['round1', 'round2', 'round3', 'round4', 'results'] as const).indexOf(currentRound) > i) ? 'bg-spotify-green/50' : 'bg-spotify-gray/50'}`} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
